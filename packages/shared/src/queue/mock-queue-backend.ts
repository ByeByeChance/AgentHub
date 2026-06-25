import type { QueueBackend, MessageHandler } from './interfaces/queue-backend.interface.js';

interface EnqueuedMessage {
  exchange: string;
  routingKey: string;
  message: unknown;
}

interface Subscription {
  exchange: string;
  queue: string;
  bindingKey: string;
  handler: MessageHandler;
}

/**
 * In-memory QueueBackend for testing.
 *
 * Supports wildcard binding keys:
 * - `*` matches exactly one word segment (dot-delimited).
 * - `#` matches zero or more segments.
 */
export class MockQueueBackend implements QueueBackend {
  readonly name = 'mock';

  private subscriptions: Subscription[] = [];
  private publishedMessages: EnqueuedMessage[] = [];

  async publish(exchange: string, routingKey: string, message: unknown): Promise<void> {
    this.publishedMessages.push({ exchange, routingKey, message });

    // Deliver to matching subscribers asynchronously
    for (const sub of this.subscriptions) {
      if (sub.exchange !== exchange) continue;
      if (!this.bindingKeyMatches(sub.bindingKey, routingKey)) continue;

      // Fire-and-forget handler (simulates async delivery)
      void sub.handler(message, async () => {}, async (requeue?: boolean) => {
        if (requeue) {
          // Re-deliver the message to this subscriber
          void sub.handler(message, async () => {}, async () => {});
        }
      });
    }
  }

  async subscribe(
    exchange: string,
    queue: string,
    bindingKey: string,
    handler: MessageHandler,
  ): Promise<void> {
    this.subscriptions.push({ exchange, queue, bindingKey, handler });
  }

  async close(): Promise<void> {
    this.subscriptions = [];
    this.publishedMessages = [];
  }

  /** Test helper: return all published messages for assertions. */
  getPublishedMessages(): ReadonlyArray<EnqueuedMessage> {
    return this.publishedMessages;
  }

  /** Test helper: clear published message history. */
  clearPublishedMessages(): void {
    this.publishedMessages = [];
  }

  // ── private ──

  /**
   * Simple wildcard matching:
   * - `*` matches exactly one dot-delimited word.
   * - `#` matches zero or more words.
   */
  private bindingKeyMatches(bindingKey: string, routingKey: string): boolean {
    if (bindingKey === '#') return true;

    const bindingParts = bindingKey.split('.');
    const routingParts = routingKey.split('.');

    let bi = 0;
    let ri = 0;

    while (bi < bindingParts.length) {
      const bp = bindingParts[bi];
      if (bp === '#') {
        // # matches the rest — always true
        return true;
      }
      if (bp === '*') {
        if (ri >= routingParts.length) return false;
        bi++;
        ri++;
        continue;
      }
      if (bp !== routingParts[ri]) return false;
      bi++;
      ri++;
    }

    return ri === routingParts.length && bi === bindingParts.length;
  }
}
