/**
 * Token Bucket rate limiter.
 *
 * Each key (e.g., client IP, API key) gets its own independent bucket.
 * Tokens refill at a fixed rate up to the bucket's capacity.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number }>();
  readonly tokensPerInterval: number;
  readonly intervalMs: number;
  readonly bucketSize: number;

  constructor(config: RateLimiterConfig = {}) {
    this.tokensPerInterval = config.tokensPerInterval ?? 100;
    this.intervalMs = (config.intervalSeconds ?? 60) * 1000;
    this.bucketSize = config.bucketSize ?? this.tokensPerInterval;
  }

  /**
   * Try to consume tokens for a given key. Returns true if allowed.
   */
  consume(key: string, tokens = 1): boolean {
    this.refill(key);

    const bucket = this.buckets.get(key);
    if (!bucket) return false;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  /** Return the current token count for a key. Useful for diagnostics. */
  getTokens(key: string): number {
    this.refill(key);
    return this.buckets.get(key)?.tokens ?? this.bucketSize;
  }

  /** Reset all buckets. Useful for testing. */
  reset(): void {
    this.buckets.clear();
  }

  // ── private ──

  private refill(key: string): void {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      // New key starts with a full bucket
      this.buckets.set(key, { tokens: this.bucketSize, lastRefill: now });
      return;
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed <= 0) return;

    const tokensToAdd = (elapsed / this.intervalMs) * this.tokensPerInterval;
    if (tokensToAdd < 1) return; // No meaningful refill yet

    bucket.tokens = Math.min(this.bucketSize, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}

export interface RateLimiterConfig {
  /** Tokens added per interval. Default: 100. */
  tokensPerInterval?: number;
  /** Interval duration in seconds. Default: 60. */
  intervalSeconds?: number;
  /** Maximum bucket capacity. Default: same as tokensPerInterval. */
  bucketSize?: number;
}
