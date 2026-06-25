import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafetyNet, SafetyNetBlockedError } from '../../reliability/safety-net.js';
import { CircuitBreaker, RateLimiter, CostGuard } from '@agenthub/shared/reliability';
import type { Logger } from '@agenthub/shared/logging';

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger;
}

describe('SafetyNet', () => {
  let rateLimiter: RateLimiter;
  let costGuard: CostGuard;
  let circuitBreaker: CircuitBreaker;
  let logger: Logger;

  beforeEach(() => {
    rateLimiter = new RateLimiter({ tokensPerInterval: 10, intervalSeconds: 60 });
    costGuard = new CostGuard({
      maxTokensPerRun: 100,
      maxCostPerSession: 5,
      maxDailyCost: 50,
    });
    circuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
    logger = makeLogger();
  });

  describe('check', () => {
    it('should allow request when all gates pass', () => {
      const safetyNet = new SafetyNet(rateLimiter, costGuard, circuitBreaker, logger);
      const result = safetyNet.check({ key: 'test-key' });
      expect(result.allowed).toBe(true);
    });

    it('should block by rate limiter when tokens exhausted', () => {
      // Create rate limiter with only 1 token
      const strictRL = new RateLimiter({ tokensPerInterval: 1, intervalSeconds: 3600 });
      const safetyNet = new SafetyNet(strictRL, costGuard, circuitBreaker, logger);

      // Consume the only token
      strictRL.consume('key1');
      // Second consume should fail
      const result = safetyNet.check({ key: 'key1' });
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('rate_limiter');
      expect(result.statusCode).toBe(429);
    });

    it('should block by cost guard when tokens exceed limit', () => {
      const safetyNet = new SafetyNet(rateLimiter, costGuard, circuitBreaker, logger);
      // 101 tokens exceeds maxTokensPerRun=100
      const result = safetyNet.check({ tokensIn: 101, tokensOut: 0 });
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('cost_guard');
      expect(result.statusCode).toBe(402);
    });

    it('should allow when disabled gates are skipped', () => {
      const safetyNet = new SafetyNet(rateLimiter, costGuard, circuitBreaker, logger, {
        enableRateLimiter: false,
        enableCostGuard: false,
      });
      const result = safetyNet.check({ tokensIn: 9999, tokensOut: 0 });
      expect(result.allowed).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute function when all gates pass', async () => {
      const safetyNet = new SafetyNet(rateLimiter, costGuard, circuitBreaker, logger);

      const result = await safetyNet.execute({ key: 'exec-key' }, async () => 'success');
      expect(result).toBe('success');
    });

    it('should throw SafetyNetBlockedError when rate limited', async () => {
      const strictRL = new RateLimiter({ tokensPerInterval: 0, intervalSeconds: 3600 });
      const safetyNet = new SafetyNet(strictRL, costGuard, circuitBreaker, logger);

      await expect(
        safetyNet.execute({ key: 'blocked-key' }, async () => 'never'),
      ).rejects.toThrow(SafetyNetBlockedError);
    });

    it('should execute through circuit breaker', async () => {
      const safetyNet = new SafetyNet(rateLimiter, costGuard, circuitBreaker, logger);

      let calls = 0;
      const result = await safetyNet.execute({}, async () => {
        calls++;
        return 'through-cb';
      });

      expect(result).toBe('through-cb');
      expect(calls).toBe(1);
    });

    it('should trip circuit breaker on repeated failures', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 60000 });
      const safetyNet = new SafetyNet(rateLimiter, costGuard, cb, logger);

      // First failure
      await safetyNet.execute({}, async () => {
        throw new Error('fail-1');
      }).catch(() => {});

      // Second failure — trips circuit breaker
      await safetyNet.execute({}, async () => {
        throw new Error('fail-2');
      }).catch(() => {});

      // Third call should fast-fail via circuit breaker
      await expect(
        safetyNet.execute({}, async () => 'should-not-reach'),
      ).rejects.toThrow();
    });
  });
});
