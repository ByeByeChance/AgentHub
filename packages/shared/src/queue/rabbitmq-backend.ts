import type { QueueBackend, MessageHandler } from './interfaces/queue-backend.interface.js';
import type { ChannelModel, Channel, ConsumeMessage } from 'amqplib';

/**
 * RabbitMQ-backed QueueBackend using AMQP 0-9-1.
 *
 * Connects to a RabbitMQ broker and publishes/subscribes via a topic exchange.
 * Messages are serialized as JSON.
 */
export class RabbitMQBackend implements QueueBackend {
  readonly name = 'rabbitmq';

  private model: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly url: string;
  private closed = false;

  constructor(url: string) {
    this.url = url;
  }

  async publish(exchange: string, routingKey: string, message: unknown): Promise<void> {
    const ch = await this.getChannel();

    await ch.assertExchange(exchange, 'topic', { durable: true });
    const content = Buffer.from(JSON.stringify(message), 'utf-8');
    ch.publish(exchange, routingKey, content, { persistent: true });
  }

  async subscribe(
    exchange: string,
    queue: string,
    bindingKey: string,
    handler: MessageHandler,
  ): Promise<void> {
    const ch = await this.getChannel();

    await ch.assertExchange(exchange, 'topic', { durable: true });
    await ch.assertQueue(queue, { durable: true });
    await ch.bindQueue(queue, exchange, bindingKey);

    await ch.consume(queue, (msg: ConsumeMessage | null) => {
      if (!msg) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(msg.content.toString('utf-8'));
      } catch {
        parsed = msg.content.toString('utf-8');
      }

      const ack = async (): Promise<void> => {
        ch.ack(msg);
      };

      const nack = async (requeue = false): Promise<void> => {
        ch.nack(msg, false, requeue);
      };

      void handler(parsed, ack, nack).catch(() => {
        // Handler threw — nack without requeue (send to DLQ if configured)
        ch.nack(msg, false, false);
      });
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.channel) {
      await this.channel.close().catch(() => {});
      this.channel = null;
    }
    if (this.model) {
      await this.model.close().catch(() => {});
      this.model = null;
    }
  }

  // ── private ──

  private async getChannel(): Promise<Channel> {
    if (this.closed) {
      throw new Error('RabbitMQBackend is closed');
    }

    if (this.channel) return this.channel;

    // Dynamic import to avoid requiring amqplib at module load time
    const amqplib = await import('amqplib');
    this.model = await amqplib.connect(this.url);
    this.channel = await this.model.createChannel();
    return this.channel;
  }
}
