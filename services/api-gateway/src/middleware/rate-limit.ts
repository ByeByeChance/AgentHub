import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RateLimiter } from '@agenthub/shared/reliability';
import type { Logger } from '@agenthub/shared/logging';

/**
 * Register HTTP-level rate limiting as a preHandler hook.
 *
 * Uses the shared token-bucket RateLimiter. Each client IP gets its own
 * bucket. This is separate from the SafetyNet rate limiter inside Core
 * Engine — the gateway protects the HTTP edge, SafetyNet protects agent
 * execution.
 */
export function registerRateLimitMiddleware(
  app: FastifyInstance,
  logger: Logger,
): void {
  const rateLimiter = new RateLimiter();

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api/')) return;

    const clientKey = request.ip ?? 'unknown';

    if (!rateLimiter.consume(clientKey)) {
      logger.warn('Gateway rate limit exceeded', { clientKey, url: request.url });
      return reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry later.',
      });
    }
  });
}
