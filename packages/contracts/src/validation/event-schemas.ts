import { z } from 'zod';

export const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const EventSourceSchema = z.object({
  service: z.string().min(1),
  instanceId: z.string().min(1),
});

export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  timestamp: z.string().regex(ISO_8601_REGEX, 'Must be ISO 8601 format'),
  traceId: z.string().min(1),
  source: EventSourceSchema,
  payload: z.unknown().nullable(),
});
