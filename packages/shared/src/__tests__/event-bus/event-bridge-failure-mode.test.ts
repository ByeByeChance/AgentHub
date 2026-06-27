import { describe, it, expect, afterEach, vi } from 'vitest';
import { getEventBus } from '../../event-bus/event-bus.js';
import { EventBridge } from '../../event-bus/event-bridge.js';
import type { QueueBackend } from '../../queue/interfaces/queue-backend.interface.js';
import { createEventEnvelope } from '@agenthub/contracts';

const SOURCE = { service: 'test' as const, instanceId: 't1' };

/** A backend that always fails to publish — simulating a broken RabbitMQ. */
class BrokenQueueBackend implements QueueBackend {
  readonly name = 'broken';
  events: unknown[] = [];
  async connect() {}
  async publish(): Promise<void> { throw new Error('Connection refused'); }
  async subscribe() {}
  async close() {}
  async ack() {}
  async nack() {}
  async nackWithRequeue() {}
}

describe('EventBridge Failure Modes', () => {
  let bridge: EventBridge;

  afterEach(async () => {
    if (bridge) await bridge.stop().catch(() => {});
  });

  it('should log knowledge.* events at ERROR level', async () => {
    const bus = getEventBus();
    const spy = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    bridge = new EventBridge(bus, new BrokenQueueBackend(), spy, {
      defaultFailureMode: 'warn',
    });
    await bridge.start();

    // Wait for the run loop to start
    await new Promise((r) => setTimeout(r, 50));

    bus.emit(createEventEnvelope('knowledge.write', { doc: 'test' }, SOURCE));
    // Allow async catch block to run
    await new Promise((r) => setTimeout(r, 50));

    expect(spy.error).toHaveBeenCalled();
    expect(spy.error.mock.calls[0]?.[0]).toHaveProperty('eventType', 'knowledge.write');
  });

  it('should log unknown events at WARN by default', async () => {
    const bus = getEventBus();
    const spy = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    bridge = new EventBridge(bus, new BrokenQueueBackend(), spy);
    await bridge.start();
    await new Promise((r) => setTimeout(r, 50));

    bus.emit(createEventEnvelope('audit.log', { action: 'test' }, SOURCE));
    await new Promise((r) => setTimeout(r, 50));

    expect(spy.warn).toHaveBeenCalled();
  });

  it('should allow custom failure mode overrides', async () => {
    const bus = getEventBus();
    const spy = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    bridge = new EventBridge(bus, new BrokenQueueBackend(), spy, {
      failureModes: { 'audit.': 'info' },
      defaultFailureMode: 'warn',
    });
    await bridge.start();
    await new Promise((r) => setTimeout(r, 50));

    bus.emit(createEventEnvelope('audit.log', {}, SOURCE));
    await new Promise((r) => setTimeout(r, 50));

    expect(spy.info).toHaveBeenCalled();
    expect(spy.info.mock.calls[0]?.[0]).toHaveProperty('eventType', 'audit.log');
  });
});
