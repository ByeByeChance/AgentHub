import { randomUUID } from 'node:crypto';
import type { EventSource } from './interfaces/event-source.interface.js';
import type { EventEnvelope } from './interfaces/event-envelope.interface.js';

export function createEventEnvelope<
  TEventType extends string,
  TPayload = unknown,
>(
  eventType: TEventType,
  payload: TPayload,
  source: EventSource,
  traceId?: string,
): EventEnvelope<TEventType, TPayload> {
  return {
    eventId: randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    traceId: traceId ?? randomUUID(),
    source,
    payload,
  };
}
