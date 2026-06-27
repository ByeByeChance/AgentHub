import type { EventBus } from './interfaces/event-bus.interface.js';
import type { QueueBackend } from '../queue/interfaces/queue-backend.interface.js';
import type { EventEnvelope } from '@agenthub/contracts';

/**
 * Per-event-type failure mode for EventBridge publish failures.
 * - 'error': log at ERROR level (data-loss risk, e.g. knowledge.write)
 * - 'warn':  log at WARN level (best-effort acceptable, e.g. audit.log)
 * - 'info':  log at INFO level (purely informational events)
 */
export type BridgeFailureMode = 'error' | 'warn' | 'info';

export interface BridgeConfig {
  /** Per-event-type or prefix-based failure mode overrides. */
  failureModes?: Record<string, BridgeFailureMode>;
  /** Default failure mode for events without a specific override. */
  defaultFailureMode?: BridgeFailureMode;
}

/** Minimal logger interface — works with Pino, console, etc. */
export interface BridgeLogger {
  error(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
}

const DEFAULT_FAILURE_MODE: Record<string, BridgeFailureMode> = {
  'knowledge.': 'error',
};

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
 *   const bridge = new EventBridge(eventBus, queueBackend, logger);
 *   await bridge.start();
 *   // ... events now flow from memory bus to queue
 *   await bridge.stop();
 */
export class EventBridge {
  private readonly exchange = 'agenthub.events';
  private readonly failureModes: Record<string, BridgeFailureMode>;
  private readonly defaultMode: BridgeFailureMode;
  private running = false;
  private stopRequested = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly queueBackend: QueueBackend,
    private readonly logger: BridgeLogger = console,
    config?: BridgeConfig,
  ) {
    this.failureModes = { ...DEFAULT_FAILURE_MODE, ...config?.failureModes };
    this.defaultMode = config?.defaultFailureMode ?? 'warn';
  }

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

  /**
   * Resolve the failure mode for a given event type.
   * Matches by prefix — e.g. "knowledge." matches "knowledge.write", "knowledge.query".
   */
  private resolveFailureMode(eventType: string): BridgeFailureMode {
    for (const [prefix, mode] of Object.entries(this.failureModes)) {
      if (eventType.startsWith(prefix)) return mode;
    }
    return this.defaultMode;
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
        } catch (err) {
          // Publish failure: event is lost from the RabbitMQ perspective.
          // Log at the configured severity so the operator can decide if
          // data recovery is needed (knowledge.* events default to ERROR).
          const mode = this.resolveFailureMode(envelope.eventType);
          const logCtx = {
            eventId: envelope.eventId,
            eventType: envelope.eventType,
            traceId: envelope.traceId,
            source: envelope.source,
            error: String(err),
          };
          switch (mode) {
            case 'error':
              this.logger.error(logCtx, `EventBridge publish FAILED [${envelope.eventType}] — event may be lost`);
              break;
            case 'warn':
              this.logger.warn(logCtx, `EventBridge publish failed [${envelope.eventType}]`);
              break;
            default:
              this.logger.info(logCtx, `EventBridge publish failed [${envelope.eventType}]`);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
