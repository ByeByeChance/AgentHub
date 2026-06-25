import type { TransportStrategy, TransportReply } from '@agenthub/shared/transport';
import type { EventEnvelope } from '@agenthub/contracts';

export class StreamableHTTPTransport implements TransportStrategy {
  readonly name = 'streamable-http';

  async streamEvents(
    events: AsyncGenerator<EventEnvelope>,
    reply: TransportReply,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!reply.headerSent) {
      reply.raw.setHeader('Content-Type', 'application/x-ndjson');
      reply.raw.setHeader('Transfer-Encoding', 'chunked');
      reply.raw.setHeader('Cache-Control', 'no-cache');
    }

    let aborted = false;
    const onAbort = (): void => { aborted = true; };
    signal?.addEventListener('abort', onAbort);

    try {
      for await (const event of events) {
        if (aborted) break;
        reply.raw.write(`${JSON.stringify(event)}\n`);
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
      reply.raw.end();
    }
  }
}
