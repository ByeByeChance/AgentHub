import type { QueueBackend } from '@agenthub/shared/queue';
import type { Logger } from '@agenthub/shared/logging';
import type { AuditLogger } from './audit-logger.js';
import type { EventEnvelope } from '@agenthub/contracts';

/**
 * Subscribes to audit.* events from RabbitMQ and dispatches them
 * to the local AuditLogger for persistence with SHA-256 chain verification.
 *
 * Events handled:
 * - audit.log → auditLogger.log()
 *
 * Note: Token usage records are sent synchronously via HTTP (see
 * HttpTokenRecorder in core-engine). This consumer only handles
 * asynchronous audit events.
 */
export class ObservabilityEventConsumer {
  private readonly exchange = 'agenthub.events';
  private readonly queueName = 'observability';
  private readonly bindingKey = 'audit.*';

  constructor(
    private readonly queueBackend: QueueBackend,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    await this.queueBackend.subscribe(
      this.exchange,
      this.queueName,
      this.bindingKey,
      async (message, ack, nack) => {
        await this.handleMessage(message, ack, nack);
      },
    );
    this.logger.info('ObservabilityEventConsumer started', {
      exchange: this.exchange,
      queue: this.queueName,
      bindingKey: this.bindingKey,
    });
  }

  private async handleMessage(
    message: unknown,
    ack: () => Promise<void>,
    nack: (requeue?: boolean) => Promise<void>,
  ): Promise<void> {
    const envelope = message as EventEnvelope;

    try {
      switch (envelope.eventType) {
        case 'audit.log': {
          const payload = envelope.payload as {
            entryType?: string;
            payload?: Record<string, unknown>;
          };
          if (payload.entryType) {
            await this.auditLogger.log({
              entryType: payload.entryType,
              payload: payload.payload ?? {},
            });
          }
          break;
        }
        default:
          this.logger.debug('Unhandled observability event type', {
            eventType: envelope.eventType,
          });
      }
      await ack();
    } catch (err) {
      this.logger.error('Failed to process observability event', {
        eventType: envelope.eventType,
        error: String(err),
      });
      await nack(false); // Don't requeue — let DLQ handle it
    }
  }
}
