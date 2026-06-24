import type { EventSource } from './event-source.interface.js';

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
