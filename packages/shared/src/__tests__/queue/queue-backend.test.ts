import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { QueueBackend, MessageHandler } from '../../queue/interfaces/queue-backend.interface.js';

// We import from the source directly — this will fail until the mock is created.
// Using dynamic import to illustrate TDD RED phase.

describe('QueueBackend', () => {
  describe('MockQueueBackend', () => {
    let backend: QueueBackend;

    beforeEach(async () => {
      // Dynamic import: will resolve once MockQueueBackend is created
      const { MockQueueBackend } = await import('../../queue/mock-queue-backend.js');
      backend = new MockQueueBackend();
    });

    it('should have name "mock"', () => {
      expect(backend.name).toBe('mock');
    });

    it('should publish a message and deliver it to a matching subscriber', async () => {
      const received: unknown[] = [];
      const handler: MessageHandler = async (msg, ack) => {
        received.push(msg);
        await ack();
      };

      await backend.subscribe('agenthub.events', 'test-queue', 'knowledge.*', handler);
      await backend.publish('agenthub.events', 'knowledge.write', { content: 'test' });

      // Allow async delivery
      await vi.waitFor(() => received.length > 0, { timeout: 100 });
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ content: 'test' });
    });

    it('should not deliver to subscribers with non-matching binding keys', async () => {
      const received: unknown[] = [];
      const handler: MessageHandler = async (msg, ack) => {
        received.push(msg);
        await ack();
      };

      await backend.subscribe('agenthub.events', 'test-queue', 'audit.*', handler);
      await backend.publish('agenthub.events', 'knowledge.write', { content: 'test' });

      // Small delay to ensure async delivery would have happened
      await new Promise((r) => setTimeout(r, 10));
      expect(received).toHaveLength(0);
    });

    it('should support multiple subscribers on the same exchange', async () => {
      const received1: unknown[] = [];
      const received2: unknown[] = [];

      await backend.subscribe('agenthub.events', 'queue-1', '#', async (msg, ack) => {
        received1.push(msg);
        await ack();
      });
      await backend.subscribe('agenthub.events', 'queue-2', '#', async (msg, ack) => {
        received2.push(msg);
        await ack();
      });

      await backend.publish('agenthub.events', 'test.event', { x: 1 });

      await vi.waitFor(() => received1.length > 0, { timeout: 100 });
      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('should support wildcard (#) binding key matching all', async () => {
      const received: unknown[] = [];
      await backend.subscribe('agenthub.events', 'catchall', '#', async (msg, ack) => {
        received.push(msg);
        await ack();
      });

      await backend.publish('agenthub.events', 'any.event.at.all', 'data');
      await vi.waitFor(() => received.length > 0, { timeout: 100 });
      expect(received).toHaveLength(1);
    });

    it('should support nack with requeue', async () => {
      const received: unknown[] = [];
      let callCount = 0;
      const handler: MessageHandler = async (msg, ack, nack) => {
        callCount++;
        if (callCount === 1) {
          received.push('first-nacked');
          await nack(true); // requeue
        } else {
          received.push(msg);
          await ack();
        }
      };

      await backend.subscribe('agenthub.events', 'retry-queue', 'test.*', handler);
      await backend.publish('agenthub.events', 'test.retry', 'payload');

      await vi.waitFor(() => callCount >= 2, { timeout: 200 });
      expect(callCount).toBe(2);
      expect(received).toEqual(['first-nacked', 'payload']);
    });

    it('should close without error', async () => {
      await backend.close();
      // Should not throw
    });

    it('should record published messages for test assertions', async () => {
      // Cast to access mock-specific method (available on MockQueueBackend)
      const mock = backend as unknown as { getPublishedMessages(): Array<{ exchange: string; routingKey: string; message: unknown }> };
      await backend.publish('ex', 'rk1', { a: 1 });
      await backend.publish('ex', 'rk2', { b: 2 });

      const messages = mock.getPublishedMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ exchange: 'ex', routingKey: 'rk1', message: { a: 1 } });
      expect(messages[1]).toEqual({ exchange: 'ex', routingKey: 'rk2', message: { b: 2 } });
    });
  });

  describe('QueueBackend factory', () => {
    it('should return MockQueueBackend when QUEUE_BACKEND=mock', async () => {
      const prev = process.env.QUEUE_BACKEND;
      process.env.QUEUE_BACKEND = 'mock';
      try {
        const { createQueueBackend } = await import('../../queue/factory.js');
        const backend = createQueueBackend();
        expect(backend.name).toBe('mock');
      } finally {
        if (prev) process.env.QUEUE_BACKEND = prev; else delete process.env.QUEUE_BACKEND;
      }
    });

    it('should return MockQueueBackend when no env var set (safe default for tests)', async () => {
      const prev = process.env.QUEUE_BACKEND;
      delete process.env.QUEUE_BACKEND;
      try {
        const { createQueueBackend } = await import('../../queue/factory.js');
        const backend = createQueueBackend();
        expect(backend.name).toBe('mock');
      } finally {
        if (prev) process.env.QUEUE_BACKEND = prev;
      }
    });
  });
});
