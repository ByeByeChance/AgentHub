import type { EventEnvelope } from '@agenthub/contracts';
import type { EventBus } from './interfaces/event-bus.interface.js';

interface SubscriberEntry {
  topicPrefix: string;
  queue: EventEnvelope[];
  resolveWait: (() => void) | null;
}

class EventBusImpl implements EventBus {
  private subscribers: SubscriberEntry[] = [];

  emit(envelope: EventEnvelope): void {
    for (const sub of this.subscribers) {
      if (
        sub.topicPrefix === '' ||
        envelope.eventType.startsWith(sub.topicPrefix)
      ) {
        sub.queue.push(envelope);
        if (sub.resolveWait) {
          sub.resolveWait();
          sub.resolveWait = null;
        }
      }
    }
  }

  async *subscribe(topicPrefix: string): AsyncGenerator<EventEnvelope> {
    const entry: SubscriberEntry = {
      topicPrefix,
      queue: [],
      resolveWait: null,
    };
    this.subscribers.push(entry);

    try {
      while (this.subscribers.includes(entry)) {
        if (entry.queue.length > 0) {
          yield entry.queue.shift()!;
        } else {
          await new Promise<void>((resolve) => {
            entry.resolveWait = resolve;
          });
        }
      }
    } finally {
      const idx = this.subscribers.indexOf(entry);
      if (idx !== -1) {
        this.subscribers.splice(idx, 1);
      }
    }
  }

  unsubscribe(topicPrefix: string): void {
    this.subscribers = this.subscribers.filter(
      (s) => s.topicPrefix !== topicPrefix,
    );
  }

  reset(): void {
    this.subscribers = [];
  }
}

// HMR-safe singleton
const globalKey = Symbol.for('agenthub.eventbus');

export function getEventBus(): EventBus {
  const g = globalThis as unknown as Record<symbol, EventBus>;
  if (!g[globalKey]) {
    g[globalKey] = new EventBusImpl();
  }
  return g[globalKey];
}
