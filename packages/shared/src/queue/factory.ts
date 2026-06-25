import type { QueueBackend } from './interfaces/queue-backend.interface.js';
import { MockQueueBackend } from './mock-queue-backend.js';

/**
 * Create a QueueBackend instance based on the QUEUE_BACKEND environment variable.
 *
 * - `rabbitmq` → RabbitMQBackend (requires RABBITMQ_URL)
 * - `mock` or unset → MockQueueBackend (safe default for dev/test)
 *
 * Additional backends (redis, nats) can be added in future milestones.
 */
export function createQueueBackend(url?: string): QueueBackend {
  const backend = process.env.QUEUE_BACKEND ?? 'mock';

  if (backend === 'rabbitmq') {
    // Lazy import to avoid requiring amqplib when using mock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RabbitMQBackend } = require('./rabbitmq-backend.js') as typeof import('./rabbitmq-backend.js');
    const rabbitUrl = url ?? process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
    return new RabbitMQBackend(rabbitUrl);
  }

  // Default: mock (also covers 'redis', 'nats' — not yet implemented)
  return new MockQueueBackend();
}
