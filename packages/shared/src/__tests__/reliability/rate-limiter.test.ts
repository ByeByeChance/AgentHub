import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../../reliability/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ tokensPerInterval: 10, intervalSeconds: 60 });
  });

  it('should allow consumption within budget', () => {
    for (let i = 0; i < 10; i++) {
      expect(limiter.consume('key1')).toBe(true);
    }
  });

  it('should reject after budget exhausted', () => {
    for (let i = 0; i < 10; i++) limiter.consume('key1');
    expect(limiter.consume('key1')).toBe(false);
  });

  it('should track keys independently', () => {
    for (let i = 0; i < 10; i++) limiter.consume('key1');
    expect(limiter.consume('key1')).toBe(false);
    expect(limiter.consume('key2')).toBe(true);
  });

  it('should allow consumption after refill', async () => {
    const fastLimiter = new RateLimiter({ tokensPerInterval: 100, intervalSeconds: 1 });

    for (let i = 0; i < 100; i++) fastLimiter.consume('key1');
    expect(fastLimiter.consume('key1')).toBe(false);

    // Wait for refill
    await new Promise((r) => setTimeout(r, 1100));

    expect(fastLimiter.consume('key1')).toBe(true);
  });

  it('should have correct default config', () => {
    const defaultLimiter = new RateLimiter();
    expect(defaultLimiter.tokensPerInterval).toBe(100);
    expect(defaultLimiter.intervalMs).toBe(60_000);
    expect(defaultLimiter.bucketSize).toBe(100);
  });

  it('should allow custom bucketSize larger than tokensPerInterval (burst)', () => {
    const burstLimiter = new RateLimiter({ tokensPerInterval: 10, intervalSeconds: 60, bucketSize: 30 });
    // Can consume up to bucketSize immediately
    for (let i = 0; i < 30; i++) {
      expect(burstLimiter.consume('burst')).toBe(true);
    }
    expect(burstLimiter.consume('burst')).toBe(false);
  });

  it('should consume multiple tokens per call', () => {
    // Consuming 5 tokens at a time
    expect(limiter.consume('key1', 5)).toBe(true);
    expect(limiter.consume('key1', 5)).toBe(true);
    expect(limiter.consume('key1', 5)).toBe(false); // Only 10 total available
  });

  it('should reset all buckets', () => {
    for (let i = 0; i < 10; i++) limiter.consume('key1');
    expect(limiter.consume('key1')).toBe(false);

    limiter.reset();
    expect(limiter.consume('key1')).toBe(true);
  });

  it('should report correct token count', () => {
    expect(limiter.getTokens('key1')).toBe(10);
    limiter.consume('key1', 3);
    expect(limiter.getTokens('key1')).toBe(7);
  });
});
