/** Circuit breaker state machine. */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5). */
  failureThreshold?: number;
  /** Milliseconds before transitioning from OPEN to HALF_OPEN (default: 30_000). */
  resetTimeout?: number;
  /** Maximum number of requests allowed in HALF_OPEN state (default: 1). */
  halfOpenMaxRequests?: number;
}

/** Structured event emitted by the circuit breaker on state transitions. */
export interface CircuitBreakerEvent {
  type: 'open' | 'close' | 'half_open';
  state: CircuitState;
  failureCount: number;
  timestamp: string;
}

export class CircuitBreakerOpenError extends Error {
  constructor() {
    super('Circuit breaker is OPEN — request rejected');
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit breaker implementing the CLOSED → OPEN → HALF_OPEN state machine.
 *
 * - CLOSED: requests pass through normally. Consecutive failures increment a counter.
 * - OPEN: requests are immediately rejected with CircuitBreakerOpenError.
 * - HALF_OPEN: a limited number of probe requests are allowed through.
 *   - Success → transition to CLOSED (reset counter).
 *   - Failure → transition back to OPEN (restart timer).
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private halfOpenInFlight = 0;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Array<(event: CircuitBreakerEvent) => void> = [];

  readonly failureThreshold: number;
  readonly resetTimeout: number;
  readonly halfOpenMaxRequests: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeout = config.resetTimeout ?? 30_000;
    this.halfOpenMaxRequests = config.halfOpenMaxRequests ?? 1;
  }

  /** Current circuit state. */
  get currentState(): CircuitState {
    return this.state;
  }

  /** Current consecutive failure count. */
  get currentFailureCount(): number {
    return this.failureCount;
  }

  /** Register a listener for state transition events. */
  onTransition(listener: (event: CircuitBreakerEvent) => void): void {
    this.listeners.push(listener);
  }

  /** Execute an async function with circuit breaker protection. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new CircuitBreakerOpenError();
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenInFlight >= this.halfOpenMaxRequests) {
        throw new CircuitBreakerOpenError();
      }
      this.halfOpenInFlight++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
      }
    }
  }

  /** Reset the circuit breaker to its initial CLOSED state (useful for testing). */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenInFlight = 0;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  // ── private ──

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('CLOSED');
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;

    if (
      this.state === 'CLOSED' &&
      this.failureCount >= this.failureThreshold
    ) {
      this.transitionTo('OPEN');
      this.scheduleReset();
    } else if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
      this.scheduleReset();
    }
  }

  private scheduleReset(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.transitionTo('HALF_OPEN');
    }, this.resetTimeout);
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    const event: CircuitBreakerEvent = {
      type: newState === 'CLOSED' ? 'close' : newState === 'OPEN' ? 'open' : 'half_open',
      state: newState,
      failureCount: this.failureCount,
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
