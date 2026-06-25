import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../../reliability/circuit-breaker.js';

describe('CircuitBreaker', () => {
  describe('state machine', () => {
    it('should start in CLOSED state', () => {
      const cb = new CircuitBreaker();
      expect(cb.currentState).toBe('CLOSED');
      expect(cb.currentFailureCount).toBe(0);
    });

    it('should execute successful function in CLOSED state', async () => {
      const cb = new CircuitBreaker();
      const result = await cb.execute(async () => 'success');
      expect(result).toBe('success');
      expect(cb.currentState).toBe('CLOSED');
      expect(cb.currentFailureCount).toBe(0);
    });

    it('should count failures in CLOSED state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      await cb.execute(async () => { throw new Error('fail 1'); }).catch(() => {});
      expect(cb.currentFailureCount).toBe(1);
      expect(cb.currentState).toBe('CLOSED');

      await cb.execute(async () => { throw new Error('fail 2'); }).catch(() => {});
      expect(cb.currentFailureCount).toBe(2);
      expect(cb.currentState).toBe('CLOSED');
    });

    it('should transition CLOSED → OPEN after failureThreshold consecutive failures', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      for (let i = 0; i < 3; i++) {
        await cb.execute(async () => { throw new Error(`fail ${i}`); }).catch(() => {});
      }

      expect(cb.currentState).toBe('OPEN');
      expect(cb.currentFailureCount).toBe(3);
    });

    it('should fast-fail in OPEN state with CircuitBreakerOpenError', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      expect(cb.currentState).toBe('OPEN');

      await expect(cb.execute(async () => 'should not run')).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should reset failure count on successful execution in CLOSED', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });

      await cb.execute(async () => { throw new Error('fail 1'); }).catch(() => {});
      await cb.execute(async () => { throw new Error('fail 2'); }).catch(() => {});
      expect(cb.currentFailureCount).toBe(2);

      await cb.execute(async () => 'success');
      expect(cb.currentFailureCount).toBe(0);
      expect(cb.currentState).toBe('CLOSED');
    });

    it('should transition OPEN → HALF_OPEN after resetTimeout', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });

      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      expect(cb.currentState).toBe('OPEN');

      await new Promise((r) => setTimeout(r, 60));
      expect(cb.currentState).toBe('HALF_OPEN');
    });

    it('should transition HALF_OPEN → CLOSED on success', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });

      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      await new Promise((r) => setTimeout(r, 60));
      expect(cb.currentState).toBe('HALF_OPEN');

      const result = await cb.execute(async () => 'recovered');
      expect(result).toBe('recovered');
      expect(cb.currentState).toBe('CLOSED');
      expect(cb.currentFailureCount).toBe(0);
    });

    it('should transition HALF_OPEN → OPEN on failure', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });

      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      await new Promise((r) => setTimeout(r, 60));
      expect(cb.currentState).toBe('HALF_OPEN');

      await cb.execute(async () => { throw new Error('fail again'); }).catch(() => {});
      expect(cb.currentState).toBe('OPEN');
    });

    it('should limit concurrent requests in HALF_OPEN state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50, halfOpenMaxRequests: 1 });

      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      await new Promise((r) => setTimeout(r, 60));
      expect(cb.currentState).toBe('HALF_OPEN');

      // First request takes the slot (never resolves, we don't await)
      void cb.execute(async () => new Promise(() => {})); // hangs forever
      // Let the microtask queue flush so the inFlight counter increments
      await new Promise((r) => setTimeout(r, 5));

      // Second request should be rejected
      await expect(cb.execute(async () => 'b')).rejects.toThrow(CircuitBreakerOpenError);

      // Cleanup: reset the circuit breaker since firstPromise hangs
      cb.reset();
    });

    it('should reset() back to CLOSED', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      expect(cb.currentState).toBe('OPEN');

      cb.reset();
      expect(cb.currentState).toBe('CLOSED');
      expect(cb.currentFailureCount).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit open event when circuit opens', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      const events: Array<{ type: string; state: string }> = [];
      cb.onTransition((e) => events.push({ type: e.type, state: e.state }));

      await cb.execute(async () => { throw new Error('fail 1'); }).catch(() => {});
      expect(events).toHaveLength(0); // Not threshold yet

      await cb.execute(async () => { throw new Error('fail 2'); }).catch(() => {});
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'open', state: 'OPEN' });
    });

    it('should emit half_open and close events during recovery', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });
      const events: Array<{ type: string; state: string }> = [];
      cb.onTransition((e) => events.push({ type: e.type, state: e.state }));

      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      expect(events).toEqual([{ type: 'open', state: 'OPEN' }]);

      await new Promise((r) => setTimeout(r, 60));
      expect(events[1]).toEqual({ type: 'half_open', state: 'HALF_OPEN' });

      await cb.execute(async () => 'ok');
      expect(events[2]).toEqual({ type: 'close', state: 'CLOSED' });
    });

    it('should support multiple listeners', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      let count = 0;
      cb.onTransition(() => count++);
      cb.onTransition(() => count++);

      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      expect(count).toBe(2);
    });
  });

  describe('CircuitBreakerOpenError', () => {
    it('should be an instance of Error', () => {
      const err = new CircuitBreakerOpenError();
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('CircuitBreakerOpenError');
      expect(err.message).toContain('OPEN');
    });
  });

  describe('config defaults', () => {
    it('should use default values when no config provided', () => {
      const cb = new CircuitBreaker();
      expect(cb.failureThreshold).toBe(5);
      expect(cb.resetTimeout).toBe(30_000);
      expect(cb.halfOpenMaxRequests).toBe(1);
    });

    it('should accept custom config values', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 10_000, halfOpenMaxRequests: 2 });
      expect(cb.failureThreshold).toBe(3);
      expect(cb.resetTimeout).toBe(10_000);
      expect(cb.halfOpenMaxRequests).toBe(2);
    });
  });
});
