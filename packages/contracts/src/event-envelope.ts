import { z } from 'zod';
import { randomUUID } from 'node:crypto';

export const EventSourceSchema = z.object({
  service: z.string().min(1),
  instanceId: z.string().min(1),
});

export interface EventSource {
  service: string;
  instanceId: string;
}

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  timestamp: z.string().regex(ISO_8601_REGEX, 'Must be ISO 8601 format'),
  traceId: z.string().min(1),
  source: EventSourceSchema,
  payload: z.unknown().nullable(),
});

export interface EventEnvelope<
  TEventType extends string = string,
  TPayload = unknown,
> {
  eventId: string;
  eventType: TEventType;
  timestamp: string;
  traceId: string;
  source: EventSource;
  payload: TPayload;
}

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
