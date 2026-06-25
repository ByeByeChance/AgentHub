import type { CircuitBreaker } from '@agenthub/shared/reliability';
import type { CostGuard, GuardResult } from '@agenthub/shared/reliability';
import type { RateLimiter } from '@agenthub/shared/reliability';
import type { Logger } from '@agenthub/shared/logging';

/**
 * Layer 6 — Safety Net: ordered gating chain that protects the agent
 * runtime from cascading failures and runaway costs.
 *
 * Gate order (each must pass before AgentRun proceeds):
 *   RateLimiter  → CostGuard  → CircuitBreaker  → AgentRun
 *     (429)         (402)          (503)
 *
 * Each gate is independently configurable and can be disabled.
 */

export interface SafetyNetConfig {
  /** Enable rate limiting gate. Default: true */
  enableRateLimiter?: boolean;
  /** Enable cost guard gate. Default: true */
  enableCostGuard?: boolean;
  /** Enable circuit breaker gate. Default: true */
  enableCircuitBreaker?: boolean;
}

export interface SafetyNetResult {
  /** Whether all gates passed */
  allowed: boolean;
  /** HTTP status code to return if blocked */
  statusCode?: number;
  /** Reason for rejection */
  reason?: string;
  /** Which gate blocked the request */
  blockedBy?: 'rate_limiter' | 'cost_guard' | 'circuit_breaker';
}

export class SafetyNet {
  private readonly config: Required<SafetyNetConfig>;

  constructor(
    private readonly rateLimiter: RateLimiter | null,
    private readonly costGuard: CostGuard | null,
    private readonly circuitBreaker: CircuitBreaker | null,
    private readonly logger: Logger,
    config: SafetyNetConfig = {},
  ) {
    this.config = {
      enableRateLimiter: config.enableRateLimiter ?? true,
      enableCostGuard: config.enableCostGuard ?? true,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
    };
  }

  /**
   * Run the safety gate chain. Returns `{ allowed: true }` if all
   * enabled gates pass, or the blocking gate's details on failure.
   */
  check(params: {
    /** API key or client identifier for rate limiting */
    key?: string;
    /** Input tokens for cost guard check */
    tokensIn?: number;
    /** Output tokens for cost guard check */
    tokensOut?: number;
    /** Session identifier for cost guard */
    sessionId?: string;
  }): SafetyNetResult {
    // Gate 1: Rate Limiter
    if (this.config.enableRateLimiter && this.rateLimiter) {
      const key = params.key ?? 'default';
      if (!this.rateLimiter.consume(key)) {
        this.logger.warn('Rate limiter blocked request', { key });
        return {
          allowed: false,
          statusCode: 429,
          reason: 'Rate limit exceeded',
          blockedBy: 'rate_limiter',
        };
      }
    }

    // Gate 2: Cost Guard
    if (this.config.enableCostGuard && this.costGuard) {
      const result: GuardResult = this.costGuard.check({
        tokensIn: params.tokensIn ?? 0,
        tokensOut: params.tokensOut ?? 0,
        cost: 0,
      });

      if (!result.allowed) {
        this.logger.warn('Cost guard blocked request', { reason: result.reason });
        return {
          allowed: false,
          statusCode: 402,
          reason: result.reason ?? 'Cost limit exceeded',
          blockedBy: 'cost_guard',
        };
      }
    }

    // Gate 3: Circuit Breaker (checked at execution time via execute())
    // Note: The circuit breaker is checked inline during AgentRunner execution
    // via circuitBreaker.execute(fn). This gate serves as a pre-flight check.
    if (this.config.enableCircuitBreaker && this.circuitBreaker) {
      // The circuit breaker's execute() method is async, so the pre-flight
      // check is a no-op here. The actual protection happens when the
      // agent run is wrapped in circuitBreaker.execute().
      // We keep this gate for logging/documentation purposes.
      this.logger.debug('Circuit breaker gate active (protection via execute wrapper)');
    }

    return { allowed: true };
  }

  /**
   * Wrap a function in the safety net. Checks all gates, then executes
   * the given function through the circuit breaker.
   *
   * @returns The function result, or throws if a gate blocks.
   */
  async execute<T>(
    params: {
      key?: string;
      tokensIn?: number;
      tokensOut?: number;
      sessionId?: string;
    },
    fn: () => Promise<T>,
  ): Promise<T> {
    // Check rate limit and cost gates
    const gateCheck = this.check(params);
    if (!gateCheck.allowed) {
      throw new SafetyNetBlockedError(gateCheck);
    }

    // Execute through circuit breaker
    if (this.config.enableCircuitBreaker && this.circuitBreaker) {
      return this.circuitBreaker.execute(fn);
    }

    return fn();
  }
}

export class SafetyNetBlockedError extends Error {
  public readonly result: SafetyNetResult;

  constructor(result: SafetyNetResult) {
    super(result.reason ?? 'Request blocked by safety net');
    this.name = 'SafetyNetBlockedError';
    this.result = result;
  }
}
