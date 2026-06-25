import { describe, it, expect, beforeEach } from 'vitest';
import { CostGuard } from '../../reliability/cost-guard.js';

describe('CostGuard', () => {
  let guard: CostGuard;

  beforeEach(() => {
    guard = new CostGuard({
      maxTokensPerRun: 1000,
      maxCostPerSession: 1.0,
      maxDailyCost: 10.0,
    });
  });

  it('should allow usage within all limits', () => {
    const result = guard.check({ tokensIn: 100, tokensOut: 200, cost: 0.01, sessionId: 's1', totalTokensForRun: 0 });
    expect(result.allowed).toBe(true);
  });

  it('should reject when per-run token limit exceeded', () => {
    const result = guard.check({
      tokensIn: 500,
      tokensOut: 600,
      cost: 0.01,
      totalTokensForRun: 500 + 600, // 1100 > 1000
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Per-run token limit');
  });

  it('should reject when session cost limit exceeded', () => {
    // First call: cost $0.80
    expect(guard.check({ tokensIn: 100, tokensOut: 100, cost: 0.80, sessionId: 's1', totalTokensForRun: 0 }).allowed).toBe(true);
    // Second call: pushes session over $1.00
    const result = guard.check({ tokensIn: 100, tokensOut: 100, cost: 0.30, sessionId: 's1', totalTokensForRun: 0 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Session cost limit');
  });

  it('should reject when daily cost limit exceeded', () => {
    guard.reset();
    // Spend $9.50
    guard.check({ tokensIn: 1, tokensOut: 1, cost: 9.50, totalTokensForRun: 0 });
    // Next $1.00 pushes over $10.00
    const result = guard.check({ tokensIn: 1, tokensOut: 1, cost: 1.00, totalTokensForRun: 0 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily cost limit');
  });

  it('should track session costs independently', () => {
    expect(guard.check({ tokensIn: 10, tokensOut: 10, cost: 0.50, sessionId: 's1', totalTokensForRun: 0 }).allowed).toBe(true);
    expect(guard.check({ tokensIn: 10, tokensOut: 10, cost: 0.50, sessionId: 's2', totalTokensForRun: 0 }).allowed).toBe(true);
    expect(guard.getSessionCost('s1')).toBe(0.50);
    expect(guard.getSessionCost('s2')).toBe(0.50);
  });

  it('should report session and daily costs', () => {
    guard.reset();
    guard.check({ tokensIn: 1, tokensOut: 1, cost: 3.0, sessionId: 's1', totalTokensForRun: 0 });
    expect(guard.getSessionCost('s1')).toBe(3.0);
    expect(guard.getDailyCost()).toBe(3.0);
  });

  it('should have correct default config', () => {
    const defaultGuard = new CostGuard();
    expect(defaultGuard.maxTokensPerRun).toBe(100_000);
    expect(defaultGuard.maxCostPerSession).toBe(5.0);
    expect(defaultGuard.maxDailyCost).toBe(50.0);
  });
});
