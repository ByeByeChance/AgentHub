import type { FastifyInstance } from 'fastify';
import type { EventBus } from '@agenthub/shared/event-bus';
import type { TransportStrategy } from '@agenthub/shared/transport';
import { toTransportReply } from './transport-reply.js';

export function registerEventRoutes(
  app: FastifyInstance,
  eventBus: EventBus,
  transport: TransportStrategy,
): void {
  app.get('/api/events', async (request, reply) => {
    const { topic } = request.query as { topic?: string };

    const controller = new AbortController();
    request.raw.on('close', () => controller.abort());

    const topicKey = topic ?? '';
    const subscriber = eventBus.subscribe(topicKey);

    // Wrap subscriber to unsubscribe on abort
    async function* subscriberWithCleanup() {
      try {
        for await (const event of subscriber) {
          if (controller.signal.aborted) break;
          yield event;
        }
      } finally {
        eventBus.unsubscribe(topicKey);
      }
    }

    await transport.streamEvents(subscriberWithCleanup(), toTransportReply(reply), controller.signal);
  });
}
