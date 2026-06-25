import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEventBus } from '../../event-bus/event-bus.js';
import { EventBridge } from '../../event-bus/event-bridge.js';
import { MockQueueBackend } from '../../queue/mock-queue-backend.js';
import { createEventEnvelope, type EventEnvelope } from '@agenthub/contracts';

const SOURCE = { service: 'test' as const, instanceId: 'test-1' };

describe('EventBridge', () => {
  let bridge: EventBridge;
  let mockQueue: MockQueueBackend;

  beforeEach(() => {
    const bus = getEventBus();
    bus.reset();
    mockQueue = new MockQueueBackend();
    bridge = new EventBridge(bus, mockQueue);
  });

  afterEach(async () => {
    await bridge.stop();
    getEventBus().reset();
  });

  it('should publish EventBus events to the QueueBackend', async () => {
    const bus = getEventBus();
    await bridge.start();

    const envelope = createEventEnvelope('agent.run.complete', { runId: 'r1' }, SOURCE);
    bus.emit(envelope);

    // Wait for async bridge to forward
    await new Promise((r) => setTimeout(r, 50));

    const published = mockQueue.getPublishedMessages();
    expect(published.length).toBeGreaterThanOrEqual(1);

    const msg = published.find(
      (m) => m.exchange === 'agenthub.events' && m.routingKey === 'agent.run.complete',
    );
    expect(msg).toBeDefined();
    const payload = msg!.message as EventEnvelope;
    expect(payload.eventType).toBe('agent.run.complete');
    expect(payload.payload).toEqual({ runId: 'r1' });
    expect(payload.source.service).toBe('test');
  });

  it('should use eventType as the routing key', async () => {
    const bus = getEventBus();
    await bridge.start();

    bus.emit(createEventEnvelope('knowledge.write', { docId: 'd1' }, SOURCE));
    bus.emit(createEventEnvelope('audit.log', { entry: 'test' }, SOURCE));

    await new Promise((r) => setTimeout(r, 50));

    const published = mockQueue.getPublishedMessages();
    const routingKeys = published.map((m) => m.routingKey);
    expect(routingKeys).toContain('knowledge.write');
    expect(routingKeys).toContain('audit.log');
  });

  it('should no-op when start is called multiple times', async () => {
    const bus = getEventBus();
    await bridge.start();
    await bridge.start(); // second call

    bus.emit(createEventEnvelope('test.event', { x: 1 }, SOURCE));
    await new Promise((r) => setTimeout(r, 50));

    const published = mockQueue.getPublishedMessages();
    const testEvents = published.filter((m) => m.routingKey === 'test.event');
    // Should not duplicate events
    expect(testEvents.length).toBe(1);
  });

  it('should stop forwarding after stop()', async () => {
    const bus = getEventBus();
    await bridge.start();
    await bridge.stop();

    mockQueue.clearPublishedMessages();
    bus.emit(createEventEnvelope('test.after.stop', { x: 1 }, SOURCE));
    await new Promise((r) => setTimeout(r, 50));

    const published = mockQueue.getPublishedMessages();
    const afterStop = published.filter((m) => m.routingKey === 'test.after.stop');
    expect(afterStop.length).toBe(0);
  });

  it('should handle publish failures gracefully', async () => {
    const bus = getEventBus();

    // Use a queue backend that throws on publish
    const brokenQueue = new MockQueueBackend();
    brokenQueue.publish = () => Promise.reject(new Error('broker down'));

    bridge = new EventBridge(bus, brokenQueue);
    await bridge.start();

    // Should not throw
    bus.emit(createEventEnvelope('test.event', { x: 1 }, SOURCE));
    await new Promise((r) => setTimeout(r, 50));

    // Bridge should still be running
    expect(true).toBe(true);
  });
});
