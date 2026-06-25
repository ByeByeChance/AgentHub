import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDeadLetterQueue } from '../../reliability/dead-letter.js';

describe('InMemoryDeadLetterQueue', () => {
  let dlq: InMemoryDeadLetterQueue;

  beforeEach(() => {
    dlq = new InMemoryDeadLetterQueue({
      maxRetries: 3,
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
    });
  });

  describe('add', () => {
    it('should create a dead letter entry with metadata', async () => {
      const entry = await dlq.add({
        exchange: 'agenthub.events',
        routingKey: 'agent.run.failed',
        message: { runId: 'r1' },
        error: 'Connection timeout',
      });

      expect(entry.id).toMatch(/^dlq-/);
      expect(entry.exchange).toBe('agenthub.events');
      expect(entry.routingKey).toBe('agent.run.failed');
      expect(entry.message).toEqual({ runId: 'r1' });
      expect(entry.error).toBe('Connection timeout');
      expect(entry.retryCount).toBe(0);
      expect(entry.firstFailedAt).toBeTruthy();
      expect(entry.lastFailedAt).toBeTruthy();
      expect(entry.nextRetryAt).toBeTruthy();
    });

    it('should set nextRetryAt to baseDelayMs from now', async () => {
      const before = Date.now();
      const entry = await dlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err',
      });
      const nextRetry = new Date(entry.nextRetryAt!).getTime();
      // Should be ~1000ms from now (give or take a few ms)
      expect(nextRetry - before).toBeGreaterThanOrEqual(900);
      expect(nextRetry - before).toBeLessThan(1200);
    });
  });

  describe('getRetryable', () => {
    it('should return entries whose nextRetryAt has passed', async () => {
      const entry = await dlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err',
      });

      // Manually set nextRetryAt to the past
      (entry as { nextRetryAt: string }).nextRetryAt = new Date(Date.now() - 1000).toISOString();

      const retryable = await dlq.getRetryable();
      expect(retryable.length).toBe(1);
      expect(retryable[0]!.id).toBe(entry.id);
    });

    it('should not return entries whose nextRetryAt is in the future', async () => {
      await dlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err',
      });

      // Default nextRetryAt is ~1s in the future
      const retryable = await dlq.getRetryable();
      expect(retryable.length).toBe(0);
    });

    it('should not return permanently dead entries', async () => {
      const entry = await dlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err',
      });
      (entry as { nextRetryAt: string | null }).nextRetryAt = null;

      const retryable = await dlq.getRetryable();
      expect(retryable.length).toBe(0);
    });
  });

  describe('recordRetry', () => {
    it('should increment retryCount and compute exponential backoff', async () => {
      const entry = await dlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err1',
      });

      // First retry
      const after1 = await dlq.recordRetry(entry.id, 'err2');
      expect(after1).not.toBeNull();
      expect(after1!.retryCount).toBe(1);
      expect(after1!.error).toBe('err2');
      // nextRetryAt should be ~ baseDelay * 2^1 = 2000ms from now
      const delay1 = new Date(after1!.nextRetryAt!).getTime() - Date.now();
      expect(delay1).toBeGreaterThan(1500);
      expect(delay1).toBeLessThan(2500);

      // Second retry
      const after2 = await dlq.recordRetry(entry.id, 'err3');
      expect(after2!.retryCount).toBe(2);
      // nextRetryAt should be ~ baseDelay * 2^2 = 4000ms from now
      const delay2 = new Date(after2!.nextRetryAt!).getTime() - Date.now();
      expect(delay2).toBeGreaterThan(3500);
      expect(delay2).toBeLessThan(5000);
    });

    it('should permanently dead-letter after maxRetries exceeded', async () => {
      const entry = await dlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: { data: 'important' },
        error: 'err',
      });

      // Retry 3 times (reaching maxRetries=3 at count 4)
      await dlq.recordRetry(entry.id, 'e1'); // count 1
      await dlq.recordRetry(entry.id, 'e2'); // count 2
      await dlq.recordRetry(entry.id, 'e3'); // count 3
      const dead = await dlq.recordRetry(entry.id, 'e4'); // count 4 > maxRetries

      expect(dead).not.toBeNull();
      expect(dead!.retryCount).toBe(4);
      expect(dead!.nextRetryAt).toBeNull();
    });

    it('should return null for unknown entry id', async () => {
      const result = await dlq.recordRetry('nonexistent', 'err');
      expect(result).toBeNull();
    });

    it('should cap delay at maxDelayMs', async () => {
      // Use custom config with low maxDelay
      const capped = new InMemoryDeadLetterQueue({
        maxRetries: 10,
        baseDelayMs: 10000,
        backoffMultiplier: 2,
        maxDelayMs: 15000,
      });

      const entry = await capped.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err',
      });

      // After 4 retries: baseDelay * 2^4 = 10000 * 16 = 160000, capped at 15000
      await capped.recordRetry(entry.id); // 1
      await capped.recordRetry(entry.id); // 2
      await capped.recordRetry(entry.id); // 3
      const after4 = await capped.recordRetry(entry.id); // 4

      const delay = new Date(after4!.nextRetryAt!).getTime() - Date.now();
      expect(delay).toBeLessThanOrEqual(16000); // ~15000 + tolerance
    });
  });

  describe('remove', () => {
    it('should remove an entry', async () => {
      const entry = await dlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err',
      });

      await dlq.remove(entry.id);
      const all = await dlq.listAll();
      expect(all.length).toBe(0);
    });

    it('should be idempotent for unknown ids', async () => {
      await expect(dlq.remove('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('listDead', () => {
    it('should return only permanently dead entries', async () => {
      const entry1 = await dlq.add({
        exchange: 'e1',
        routingKey: 'r1',
        message: {},
        error: 'err',
      });
      await dlq.add({
        exchange: 'e2',
        routingKey: 'r2',
        message: {},
        error: 'err',
      });

      // Make entry1 dead
      await dlq.recordRetry(entry1.id);
      await dlq.recordRetry(entry1.id);
      await dlq.recordRetry(entry1.id);
      await dlq.recordRetry(entry1.id); // count 4 > maxRetries 3

      const dead = await dlq.listDead();
      expect(dead.length).toBe(1);
      expect(dead[0]!.id).toBe(entry1.id);
    });
  });

  describe('reset', () => {
    it('should clear all entries', async () => {
      await dlq.add({ exchange: 'e', routingKey: 'r', message: {}, error: 'err' });
      await dlq.add({ exchange: 'e', routingKey: 'r', message: {}, error: 'err' });

      dlq.reset();
      const all = await dlq.listAll();
      expect(all.length).toBe(0);
    });
  });

  describe('config defaults', () => {
    it('should use sensible defaults when no config provided', async () => {
      const defaultDlq = new InMemoryDeadLetterQueue();
      const entry = await defaultDlq.add({
        exchange: 'e',
        routingKey: 'r',
        message: {},
        error: 'err',
      });

      const delay = new Date(entry.nextRetryAt!).getTime() - Date.now();
      expect(delay).toBeGreaterThan(4500); // default baseDelayMs = 5000
    });
  });
});
