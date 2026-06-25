/**
 * Dead Letter Queue (DLQ) — reliability layer for failed asynchronous messages.
 *
 * When a message handler nacks without requeue (or exceeds the retry limit),
 * the message lands here. The DLQ stores failed messages with metadata,
 * supports retry with exponential backoff, and permanently dead-letters
 * messages that have exhausted their retry budget.
 *
 * ── Strategy interface ──
 *
 * The `DeadLetterQueue` interface allows swapping storage backends
 * (in-memory for dev/test, PostgreSQL for production).
 */

/** A dead-lettered message with failure metadata. */
export interface DeadLetterEntry {
  /** Unique identifier for this dead-letter entry. */
  id: string;
  /** The original exchange the message was published to. */
  exchange: string;
  /** The routing key used for the original publish. */
  routingKey: string;
  /** The original message payload. */
  message: unknown;
  /** Error message from the last processing attempt. */
  error: string;
  /** Number of times this message has been retried. */
  retryCount: number;
  /** ISO 8601 timestamp of the first failure. */
  firstFailedAt: string;
  /** ISO 8601 timestamp of the most recent failure. */
  lastFailedAt: string;
  /** ISO 8601 timestamp when the next retry is allowed (null if exhausted). */
  nextRetryAt: string | null;
}

/** Configuration for the DeadLetterQueue. */
export interface DeadLetterConfig {
  /** Maximum number of retry attempts before giving up. Default: 3. */
  maxRetries?: number;
  /** Base delay between retries in milliseconds. Default: 5000. */
  baseDelayMs?: number;
  /** Backoff multiplier. Default: 2 (exponential). */
  backoffMultiplier?: number;
  /** Maximum delay cap in milliseconds. Default: 60000. */
  maxDelayMs?: number;
}

export interface DeadLetterQueue {
  readonly name: string;

  /**
   * Add a failed message to the dead letter queue.
   * Returns the created entry.
   */
  add(params: {
    exchange: string;
    routingKey: string;
    message: unknown;
    error: string;
  }): Promise<DeadLetterEntry>;

  /**
   * Return all entries eligible for retry (nextRetryAt <= now).
   * Callers should attempt to re-publish these messages.
   */
  getRetryable(): Promise<DeadLetterEntry[]>;

  /**
   * Mark a retry attempt. Increments retryCount and computes the next
   * backoff delay. If maxRetries is exceeded, sets nextRetryAt to null
   * (permanently dead).
   */
  recordRetry(id: string, error?: string): Promise<DeadLetterEntry | null>;

  /**
   * Remove an entry (e.g. after successful re-processing).
   */
  remove(id: string): Promise<void>;

  /** Return all entries (including permanently dead). */
  listAll(): Promise<DeadLetterEntry[]>;

  /** Return only permanently dead entries (nextRetryAt === null). */
  listDead(): Promise<DeadLetterEntry[]>;

  /** Clear all entries — for testing only. */
  reset(): void;
}

// ── Default implementation (in-memory) ──

let nextId = 0;

export class InMemoryDeadLetterQueue implements DeadLetterQueue {
  readonly name = 'in-memory';

  private readonly entries = new Map<string, DeadLetterEntry>();
  private readonly config: Required<DeadLetterConfig>;

  constructor(config: DeadLetterConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 5000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      maxDelayMs: config.maxDelayMs ?? 60000,
    };
  }

  async add(params: {
    exchange: string;
    routingKey: string;
    message: unknown;
    error: string;
  }): Promise<DeadLetterEntry> {
    const id = `dlq-${Date.now()}-${nextId++}`;
    const now = new Date().toISOString();
    const entry: DeadLetterEntry = {
      id,
      exchange: params.exchange,
      routingKey: params.routingKey,
      message: params.message,
      error: params.error,
      retryCount: 0,
      firstFailedAt: now,
      lastFailedAt: now,
      nextRetryAt: new Date(Date.now() + this.config.baseDelayMs).toISOString(),
    };
    this.entries.set(id, entry);
    return entry;
  }

  async getRetryable(): Promise<DeadLetterEntry[]> {
    const now = Date.now();
    const result: DeadLetterEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.nextRetryAt !== null && new Date(entry.nextRetryAt).getTime() <= now) {
        result.push(entry);
      }
    }
    return result;
  }

  async recordRetry(id: string, error?: string): Promise<DeadLetterEntry | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;

    const newCount = entry.retryCount + 1;
    const now = new Date().toISOString();

    if (newCount > this.config.maxRetries) {
      // Permanently dead
      entry.retryCount = newCount;
      entry.lastFailedAt = now;
      entry.nextRetryAt = null;
      if (error) entry.error = error;
      return entry;
    }

    // Compute next backoff: baseDelay * multiplier^retryCount, capped at maxDelay
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, newCount),
      this.config.maxDelayMs,
    );

    entry.retryCount = newCount;
    entry.lastFailedAt = now;
    entry.nextRetryAt = new Date(Date.now() + delay).toISOString();
    if (error) entry.error = error;
    return entry;
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async listAll(): Promise<DeadLetterEntry[]> {
    return Array.from(this.entries.values());
  }

  async listDead(): Promise<DeadLetterEntry[]> {
    return Array.from(this.entries.values()).filter((e) => e.nextRetryAt === null);
  }

  reset(): void {
    this.entries.clear();
    nextId = 0;
  }
}
