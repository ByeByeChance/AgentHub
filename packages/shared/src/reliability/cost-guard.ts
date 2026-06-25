/**
 * Cost guard — enforces limits on token usage and cost.
 *
 * Limits are checked per-run, per-session, and per-day.
 * When a limit is exceeded, the guard returns `{ allowed: false }` with a reason.
 */
export class CostGuard {
  readonly maxTokensPerRun: number;
  readonly maxCostPerSession: number;
  readonly maxDailyCost: number;

  // Per-session and per-day accumulators (in-memory; for production use Redis-backed).
  private sessionCosts = new Map<string, number>();
  private dailyCost = 0;
  private dailyResetDate: string | null = null;

  constructor(config: CostGuardConfig = {}) {
    this.maxTokensPerRun = config.maxTokensPerRun ?? 100_000;
    this.maxCostPerSession = config.maxCostPerSession ?? 5.0;
    this.maxDailyCost = config.maxDailyCost ?? 50.0;
  }

  /**
   * Check whether the given usage fits within all configured limits.
   * Returns `{ allowed: true }` or `{ allowed: false, reason }`.
   */
  check(params: {
    tokensIn: number;
    tokensOut: number;
    cost: number;
    sessionId?: string;
    totalTokensForRun?: number;
  }): GuardResult {
    // Always accumulate costs first (tracking is independent of enforcement)
    if (params.sessionId) {
      const sessionCost = (this.sessionCosts.get(params.sessionId) ?? 0) + params.cost;
      this.sessionCosts.set(params.sessionId, sessionCost);
    }

    this.ensureDailyReset();
    this.dailyCost += params.cost;

    // Per-run token limit
    const runTokens = params.totalTokensForRun ?? 0;
    if (runTokens + params.tokensIn + params.tokensOut > this.maxTokensPerRun) {
      return {
        allowed: false,
        reason: `Per-run token limit exceeded: ${runTokens + params.tokensIn + params.tokensOut} > ${this.maxTokensPerRun}`,
      };
    }

    // Per-session cost limit
    if (params.sessionId) {
      const sessionCost = this.sessionCosts.get(params.sessionId) ?? 0;
      if (sessionCost > this.maxCostPerSession) {
        return {
          allowed: false,
          reason: `Session cost limit exceeded: $${sessionCost.toFixed(6)} > $${this.maxCostPerSession}`,
        };
      }
    }

    // Daily cost limit
    if (this.dailyCost > this.maxDailyCost) {
      return {
        allowed: false,
        reason: `Daily cost limit exceeded: $${this.dailyCost.toFixed(6)} > $${this.maxDailyCost}`,
      };
    }

    return { allowed: true };
  }

  /** Get the current daily accumulated cost. */
  getDailyCost(): number {
    this.ensureDailyReset();
    return this.dailyCost;
  }

  /** Get the current session accumulated cost. */
  getSessionCost(sessionId: string): number {
    return this.sessionCosts.get(sessionId) ?? 0;
  }

  /** Reset all accumulators. Useful for testing. */
  reset(): void {
    this.sessionCosts.clear();
    this.dailyCost = 0;
    this.dailyResetDate = null;
  }

  // ── private ──

  private ensureDailyReset(): void {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (this.dailyResetDate !== today) {
      this.dailyCost = 0;
      this.dailyResetDate = today;
    }
  }
}

export interface CostGuardConfig {
  /** Maximum tokens allowed per single AgentRun. Default: 100_000. */
  maxTokensPerRun?: number;
  /** Maximum cost ($) per session. Default: 5.00. */
  maxCostPerSession?: number;
  /** Maximum cost ($) per calendar day. Default: 50.00. */
  maxDailyCost?: number;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}
