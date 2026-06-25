import type { TransportStrategy, TransportReply } from '@agenthub/shared/transport';
import type { EventEnvelope } from '@agenthub/contracts';

export class SSETransport implements TransportStrategy {
  readonly name = 'sse';

  async streamEvents(
    events: AsyncGenerator<EventEnvelope>,
    reply: TransportReply,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!reply.headerSent) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
    }

    let aborted = false;
    const onAbort = (): void => { aborted = true; };
    signal?.addEventListener('abort', onAbort);

    try {
      for await (const event of events) {
        if (aborted) break;
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
      reply.raw.end();
    }
  }
}
