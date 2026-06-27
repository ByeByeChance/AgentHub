import type { FastifyRequest, FastifyReply, RouteHandler } from 'fastify';
import type { Logger } from '@agenthub/shared/logging';

/**
 * Create a reverse-proxy route handler that forwards requests to Core Engine.
 *
 * Handles both regular HTTP responses and SSE (Server-Sent Events) streaming.
 * Preserves headers, query params, and request body.
 *
 * @param target  Core Engine base URL (e.g. "http://core-engine:3001")
 * @param logger  Logger for proxy diagnostics
 */
export function createProxyHandler(
  target: string,
  logger: Logger,
): RouteHandler {
  return async function proxyHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const targetUrl = `${target}${request.url}`;

    // Build forwarded headers: strip hop-by-hop, forward the rest
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (key === 'host' || key === 'connection' || key === 'transfer-encoding') continue;
      if (value != null) {
        if (Array.isArray(value)) {
          headers.set(key, value.join(', '));
        } else {
          headers.set(key, value);
        }
      }
    }
    // Tell Core Engine it's behind a proxy
    headers.set('X-Forwarded-For', request.ip);
    headers.set('X-Forwarded-Proto', request.protocol);
    headers.set('X-Gateway-Mode', 'behind-proxy');

    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        signal: AbortSignal.timeout(30_000), // 30s proxy timeout
      };

      // Forward body for write methods
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body != null) {
        fetchOptions.body = JSON.stringify(request.body);
        headers.set('Content-Type', 'application/json');
      }

      const upstream = await fetch(targetUrl, fetchOptions);

      // Copy upstream status and headers
      reply.code(upstream.status);
      for (const [key, value] of upstream.headers.entries()) {
        // Skip hop-by-hop and transfer-encoding (Fastify manages it)
        if (
          key === 'transfer-encoding' ||
          key === 'connection' ||
          key === 'keep-alive'
        ) continue;
        reply.header(key, value);
      }

      // SSE streaming: forward the stream chunk-by-chunk
      const contentType = upstream.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');

        const reader = upstream.body?.getReader();
        if (!reader) {
          reply.send('');
          return;
        }

        // Convert Fastify headers to Node.js OutgoingHttpHeaders (value must be string | string[] | undefined)
        const nodeHeaders: Record<string, string | string[] | undefined> = {};
        for (const [key, value] of Object.entries(reply.getHeaders())) {
          if (value != null) {
            nodeHeaders[key] = String(value);
          }
        }
        reply.raw.writeHead(upstream.status, nodeHeaders);

        try {
          const decoder = new TextDecoder();
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              reply.raw.write(decoder.decode(value, { stream: !done }));
            }
          }
          reply.raw.end();
        } catch (err) {
          logger.warn('SSE proxy stream error', { error: String(err) });
          if (!reply.raw.writableEnded) {
            reply.raw.end();
          }
        }
        return;
      }

      // Regular response: send full body
      const body = await upstream.text();
      reply.send(body);
    } catch (err) {
      // Connection refused, timeout, DNS resolution failure
      if ((err as { code?: string }).code === 'ECONNREFUSED') {
        logger.error('Proxy: Core Engine unreachable', { target: targetUrl });
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'Core Engine is unreachable',
        });
      }
      if ((err as { name?: string }).name === 'AbortError') {
        // Client disconnected — normal behavior
        return;
      }
      logger.error('Proxy error', { target: targetUrl, error: String(err) });
      return reply.code(502).send({
        error: 'Bad Gateway',
        message: `Proxy error: ${String(err)}`,
      });
    }
  };
}
