import type { FastifyInstance } from 'fastify';
import type { EventBus } from '@agenthub/shared/event-bus';

export function registerEventRoutes(
  app: FastifyInstance,
  eventBus: EventBus,
): void {
  app.get('/api/events', async (request, reply) => {
    const { topic } = request.query as { topic?: string };

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const subscriber = eventBus.subscribe(topic ?? '');

    request.raw.on('close', () => {
      eventBus.unsubscribe(topic ?? '');
    });

    try {
      for await (const event of subscriber) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      app.log.debug('SSE client disconnected');
    } finally {
      reply.raw.end();
    }
  });
}
