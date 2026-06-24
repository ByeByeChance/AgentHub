import type { EventEnvelope } from '@agenthub/contracts';

export interface EventBus {
  emit(envelope: EventEnvelope): void;
  subscribe(topicPrefix: string): AsyncGenerator<EventEnvelope>;
  unsubscribe(topicPrefix: string): void;
  /** Reset all subscribers — for testing only */
  reset(): void;
}
