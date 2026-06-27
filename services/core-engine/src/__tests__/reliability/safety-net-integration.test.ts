import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyNet, SafetyNetBlockedError } from '../../reliability/safety-net.js';
import { RateLimiter, CostGuard, CircuitBreaker } from '@agenthub/shared/reliability';

const mockLogger = { info() {}, warn() {}, error() {}, debug() {} } as Parameters<SafetyNet['execute']>[1] & { info: () => void };

describe('SafetyNet Full Chain', () => {
  let rateLimiter: RateLimiter;
  let costGuard: CostGuard;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    rateLimiter = new RateLimiter({ tokensPerInterval: 10 });
    costGuard = new CostGuard({ maxTokensPerRun: 100, maxDailyCost: 100 });
    circuitBreaker = new CircuitBreaker({ failureThreshold: 3 });
  });

  it('should execute function when all gates pass', async () => {
    const safety = new SafetyNet(rateLimiter, costGuard, circuitBreaker, mockLogger);
    const result = await safety.execute(
      { key: 'test', tokensIn: 5, tokensOut: 5 },
      () => Promise.resolve('success'),
    );
    expect(result).toBe('success');
  });

  it('should block when rate limiter is exhausted', async () => {
    const tinyLimiter = new RateLimiter({ tokensPerInterval: 1 });
    tinyLimiter.consume('test'); // consume the only token

    const safety = new SafetyNet(tinyLimiter, costGuard, circuitBreaker, mockLogger);
    await expect(
      safety.execute({ key: 'test', tokensIn: 1 }, () => Promise.resolve('ok')),
    ).rejects.toThrow(SafetyNetBlockedError);

    try {
      await safety.execute({ key: 'test', tokensIn: 1 }, () => Promise.resolve('ok'));
    } catch (err) {
      const e = err as SafetyNetBlockedError;
      expect(e.result.blockedBy).toBe('rate_limiter');
      expect(e.result.statusCode).toBe(429);
    }
  });

  it('should block when cost guard limit exceeded', async () => {
    const cheapGuard = new CostGuard({ maxTokensPerRun: 10 });
    const safety = new SafetyNet(rateLimiter, cheapGuard, circuitBreaker, mockLogger);
    await expect(
      safety.execute({ key: 'test', tokensIn: 20 }, () => Promise.resolve('ok')),
    ).rejects.toThrow(SafetyNetBlockedError);
  });

  it('should skip disabled gates', async () => {
    rateLimiter.consume('test'); rateLimiter.consume('test'); // exhaust
    const safety = new SafetyNet(rateLimiter, null, null, mockLogger, {
      enableRateLimiter: false,
    });
    const result = await safety.execute(
      { key: 'test' }, () => Promise.resolve('ok'),
    );
    expect(result).toBe('ok');
  });

  it('should pass all enabled gates with default config', async () => {
    const safety = new SafetyNet(
      new RateLimiter(),
      new CostGuard(),
      new CircuitBreaker(),
      mockLogger,
    );
    const result = await safety.execute(
      { key: 'default-test' }, () => Promise.resolve(42),
    );
    expect(result).toBe(42);
  });
});
