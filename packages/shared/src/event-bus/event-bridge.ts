import type { EventBus } from './interfaces/event-bus.interface.js';
import type { QueueBackend } from '../queue/interfaces/queue-backend.interface.js';
import type { EventEnvelope } from '@agenthub/contracts';

/**
 * Bridges the internal EventBus to a remote QueueBackend (RabbitMQ).
 *
 * Subscribes to all events on the in-memory EventBus and publishes each one
 * to the QueueBackend so external services can consume them asynchronously.
 *
 * Topic Exchange: agenthub.events
 * Routing Key:    eventType (e.g. "agent.run.complete", "knowledge.write")
 *
 * Usage:
 *   const bridge = new EventBridge(eventBus, queueBackend);
 *   await bridge.start();
 *   // ... events now flow from memory bus to queue
 *   await bridge.stop();
 */
export class EventBridge {
  private readonly exchange = 'agenthub.events';
  private running = false;
  private stopRequested = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly queueBackend: QueueBackend,
  ) {}

  /**
   * Start bridging events from the internal EventBus to the QueueBackend.
   * Runs an async loop consuming events from the EventBus subscription.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stopRequested = false;

    // Run in background — caller can await stop() to clean up
    void this.runLoop();
  }

  /**
   * Stop bridging and wait for the run loop to exit.
   *
   * Emits a synthetic shutdown event to wake the for-await loop that is
   * blocked waiting on the EventBus subscription, then polls until the
   * loop exits.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.stopRequested = true;

    // Emit a synthetic event to wake the blocked subscription loop.
    // The loop checks stopRequested on each iteration and exits.
    this.eventBus.emit({
      eventId: '__bridge.shutdown',
      eventType: '__bridge.shutdown',
      timestamp: new Date().toISOString(),
      traceId: '__bridge.shutdown',
      source: { service: 'event-bridge' as const, instanceId: 'shutdown' },
      payload: {},
    });

    let retries = 0;
    while (this.running && retries < 50) {
      await new Promise((r) => setTimeout(r, 100));
      retries++;
    }
  }

  // ── private ──

  private async runLoop(): Promise<void> {
    try {
      for await (const envelope of this.eventBus.subscribe('')) {
        if (this.stopRequested) break;

        try {
          await this.queueBackend.publish(
            this.exchange,
            envelope.eventType,
            envelope satisfies EventEnvelope,
          );
        } catch {
          // Publish failure is non-fatal — the event is still in the
          // EventBus memory queue; downstream services can consume
          // directly if needed.
        }
      }
    } finally {
      this.running = false;
    }
  }
}
