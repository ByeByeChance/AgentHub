import type { QueueBackend } from '@agenthub/shared/queue';
import type { Logger } from '@agenthub/shared/logging';
import type { KnowledgeService } from './knowledge-service.js';
import type { EventEnvelope } from '@agenthub/contracts';

/**
 * Subscribes to knowledge.* events from RabbitMQ and dispatches them
 * to the local KnowledgeService for processing.
 *
 * Events handled:
 * - knowledge.write  → knowledgeService.addDocument()
 * - knowledge.query  → knowledgeService.search()
 */
export class KnowledgeEventConsumer {
  private readonly exchange = 'agenthub.events';
  private readonly queueName = 'knowledge-base';
  private readonly bindingKey = 'knowledge.*';

  constructor(
    private readonly queueBackend: QueueBackend,
    private readonly knowledgeService: KnowledgeService,
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
    this.logger.info('KnowledgeEventConsumer started', {
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
        case 'knowledge.write': {
          const payload = envelope.payload as {
            text?: string;
            metadata?: Record<string, unknown>;
            source?: string;
            parentDocumentId?: string;
          };
          if (payload.text) {
            await this.knowledgeService.addDocument({
              text: payload.text,
              metadata: payload.metadata ?? {},
              source: payload.source,
              parentDocumentId: payload.parentDocumentId,
            });
          }
          break;
        }
        case 'knowledge.query': {
          // Queries are typically synchronous (HTTP). Async query results
          // would be published back via a response event. For now we log
          // and acknowledge — the event serves as an audit trail.
          this.logger.debug('Received async knowledge.query event', {
            traceId: envelope.traceId,
          });
          break;
        }
        default:
          this.logger.debug('Unhandled knowledge event type', {
            eventType: envelope.eventType,
          });
      }
      await ack();
    } catch (err) {
      this.logger.error('Failed to process knowledge event', {
        eventType: envelope.eventType,
        error: String(err),
      });
      await nack(false); // Don't requeue — let DLQ handle it
    }
  }
}
