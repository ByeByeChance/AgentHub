/**
 * Lightweight chaos injection helpers for resilience testing.
 *
 * Each injector is a function that returns a cleanup function.
 * Call reset() after each test to restore all injected failures.
 */

export interface DBProxy {
  agents: { insert: (...args: unknown[]) => Promise<unknown> };
  [key: string]: unknown;
}

export class ChaosTestContext {
  private cleanups: Array<() => void> = [];

  /** Simulate a database failure by proxying an existing DB object. */
  injectDBFailure(db: DBProxy): void {
    const original = db.agents.insert.bind(db.agents);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.agents as any).insert = async () => {
      throw new Error('Database connection lost');
    };
    this.cleanups.push(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db.agents as any).insert = original;
    });
  }

  /** Reset all chaos injections. Call in afterEach. */
  reset(): void {
    for (const cleanup of this.cleanups.reverse()) {
      cleanup();
    }
    this.cleanups = [];
  }
}
