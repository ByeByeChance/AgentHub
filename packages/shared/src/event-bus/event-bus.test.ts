import { describe, it, expect, beforeEach } from 'vitest';
import { getEventBus, type EventBus } from './event-bus.js';
import { EVENT_TYPES } from '@agenthub/contracts';
import type { EventEnvelope } from '@agenthub/contracts';

function createEnvelope(
  eventType: string,
  payload: unknown = {},
): EventEnvelope {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    source: { service: 'test', instanceId: 'test-1' },
    payload,
  };
}

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = getEventBus();
    bus.reset(); // Start fresh each test
  });

  it('should deliver emitted event to subscriber', async () => {
    const received: EventEnvelope[] = [];
    const sub = bus.subscribe('agent.');

    // Start collecting in background
    const collectPromise = (async () => {
      for await (const event of sub) {
        received.push(event);
        if (received.length >= 1) break;
      }
    })();

    // Emit after subscriber is ready
    await new Promise((r) => setTimeout(r, 10));
    bus.emit(createEnvelope(EVENT_TYPES.AGENT_RUN_START, { agentId: '1' }));

    await collectPromise;
    expect(received).toHaveLength(1);
    expect(received[0]!.eventType).toBe(EVENT_TYPES.AGENT_RUN_START);
  });

  it('should filter events by topic prefix', async () => {
    const received: EventEnvelope[] = [];
    const sub = bus.subscribe('agent.');

    const collectPromise = (async () => {
      for await (const event of sub) {
        received.push(event);
        if (received.length >= 2) break;
      }
    })();

    await new Promise((r) => setTimeout(r, 10));
    bus.emit(createEnvelope(EVENT_TYPES.AGENT_RUN_START));
    bus.emit(createEnvelope(EVENT_TYPES.MESSAGE_CREATED)); // should NOT match
    bus.emit(createEnvelope(EVENT_TYPES.AGENT_RUN_COMPLETE));

    await collectPromise;
    expect(received).toHaveLength(2);
    expect(received.every((e) => e.eventType.startsWith('agent.'))).toBe(true);
  });

  it('should survive HMR (same singleton across calls)', () => {
    const bus1 = getEventBus();
    const bus2 = getEventBus();
    expect(bus1).toBe(bus2);
  });

  it('should stop delivering after unsubscribe', async () => {
    const received: EventEnvelope[] = [];
    const sub = bus.subscribe('test.');

    const collectPromise = (async () => {
      for await (const event of sub) {
        received.push(event);
        if (received.length >= 1) break;
      }
    })();

    await new Promise((r) => setTimeout(r, 10));
    bus.emit(createEnvelope('test.event.1'));
    await collectPromise;
    expect(received).toHaveLength(1);

    // Unsubscribe and emit more
    bus.unsubscribe('test.');
    bus.emit(createEnvelope('test.event.2'));

    // Create new subscription to see if anything was queued
    const received2: EventEnvelope[] = [];
    const sub2 = bus.subscribe('test.');

    const collectPromise2 = (async () => {
      for await (const event of sub2) {
        received2.push(event);
        if (received2.length >= 1) break;
      }
    })();

    await new Promise((r) => setTimeout(r, 50));
    bus.emit(createEnvelope('test.event.3'));
    await collectPromise2;

    // Should only get the event emitted AFTER resubscribing
    expect(received2).toHaveLength(1);
    expect(received2[0]!.eventType).toBe('test.event.3');
  });

  it('should handle empty topic prefix (match all)', async () => {
    const received: EventEnvelope[] = [];
    const sub = bus.subscribe('');

    const collectPromise = (async () => {
      for await (const event of sub) {
        received.push(event);
        if (received.length >= 3) break;
      }
    })();

    await new Promise((r) => setTimeout(r, 10));
    bus.emit(createEnvelope(EVENT_TYPES.AGENT_RUN_START));
    bus.emit(createEnvelope(EVENT_TYPES.MESSAGE_CREATED));
    bus.emit(createEnvelope(EVENT_TYPES.TOOL_CALL));

    await collectPromise;
    expect(received).toHaveLength(3);
  });

  it('should not replay events emitted before subscription', async () => {
    // Emit before subscribing
    bus.emit(createEnvelope(EVENT_TYPES.AGENT_RUN_START));

    const received: EventEnvelope[] = [];
    const sub = bus.subscribe('agent.');

    const collectPromise = (async () => {
      for await (const event of sub) {
        received.push(event);
        if (received.length >= 1) break;
      }
    })();

    await new Promise((r) => setTimeout(r, 50));
    // No event emitted after subscription — should receive nothing
    // But the generator is waiting... let's emit a fresh event to unblock
    bus.emit(createEnvelope(EVENT_TYPES.AGENT_RUN_COMPLETE));
    await collectPromise;

    // Should only get the event emitted AFTER subscribing
    expect(received).toHaveLength(1);
    expect(received[0]!.eventType).toBe(EVENT_TYPES.AGENT_RUN_COMPLETE);
  });

  it('should handle high throughput', async () => {
    const received: EventEnvelope[] = [];
    const sub = bus.subscribe('');
    const count = 50;

    const collectPromise = (async () => {
      for await (const event of sub) {
        received.push(event);
        if (received.length >= count) break;
      }
    })();

    await new Promise((r) => setTimeout(r, 10));
    for (let i = 0; i < count; i++) {
      bus.emit(createEnvelope(EVENT_TYPES.SYSTEM_HEARTBEAT, { i }));
    }

    await collectPromise;
    expect(received).toHaveLength(count);
  });
});
