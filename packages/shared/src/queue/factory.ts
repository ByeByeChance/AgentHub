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
export async function createQueueBackend(url?: string): Promise<QueueBackend> {
  const backend = process.env.QUEUE_BACKEND ?? 'mock';

  if (backend === 'rabbitmq') {
    // Dynamic import (ESM-compatible) to avoid loading amqplib when using mock
    const { RabbitMQBackend } = await import('./rabbitmq-backend.js');
    const rabbitUrl = url ?? process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
    return new RabbitMQBackend(rabbitUrl);
  }

  // Default: mock (also covers 'redis', 'nats' — not yet implemented)
  return new MockQueueBackend();
}
