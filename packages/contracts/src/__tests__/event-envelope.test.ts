import { describe, it, expect } from 'vitest';
import {
  EventEnvelopeSchema,
  EventSourceSchema,
  createEventEnvelope,
} from '../event-envelope.js';
import { EVENT_TYPES } from '../event-types.js';

describe('EventEnvelopeSchema', () => {
  const validSource = { service: 'core-engine', instanceId: 'abc-123' };
  const validEnvelope = {
    eventId: '00000000-0000-0000-0000-000000000001',
    eventType: EVENT_TYPES.AGENT_RUN_START,
    timestamp: '2026-06-24T00:00:00.000Z',
    traceId: '00000000000000000000000000000001',
    source: validSource,
    payload: { message: 'hello' },
  };

  describe('validation', () => {
    it('should parse a valid event envelope', () => {
      const result = EventEnvelopeSchema.safeParse(validEnvelope);
      expect(result.success).toBe(true);
    });

    it('should reject when eventId is missing', () => {
      const { eventId: _, ...rest } = validEnvelope;
      const result = EventEnvelopeSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject when eventId is not a string', () => {
      const result = EventEnvelopeSchema.safeParse({
        ...validEnvelope,
        eventId: 123,
      });
      expect(result.success).toBe(false);
    });

    it('should accept any eventType string (base schema delegates type validation to consumers)', () => {
      const result = EventEnvelopeSchema.safeParse({
        ...validEnvelope,
        eventType: 'custom.project.specific',
      });
      expect(result.success).toBe(true);
    });

    it('should reject when timestamp is not ISO 8601 format', () => {
      const result = EventEnvelopeSchema.safeParse({
        ...validEnvelope,
        timestamp: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject when traceId is missing', () => {
      const { traceId: _, ...rest } = validEnvelope;
      const result = EventEnvelopeSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject when source.service is empty string', () => {
      const result = EventEnvelopeSchema.safeParse({
        ...validEnvelope,
        source: { service: '', instanceId: 'abc' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject when source.instanceId is missing', () => {
      const result = EventEnvelopeSchema.safeParse({
        ...validEnvelope,
        source: { service: 'core-engine' },
      });
      expect(result.success).toBe(false);
    });

    it('should accept envelope with null payload', () => {
      const result = EventEnvelopeSchema.safeParse({
        ...validEnvelope,
        payload: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept envelope with complex nested payload', () => {
      const result = EventEnvelopeSchema.safeParse({
        ...validEnvelope,
        payload: { nested: { deep: { value: [1, 2, 3] } } },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createEventEnvelope', () => {
    it('should generate a UUID eventId', () => {
      const envelope = createEventEnvelope(
        EVENT_TYPES.AGENT_RUN_START,
        { test: true },
        validSource,
      );
      expect(envelope.eventId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should set timestamp to current ISO 8601', () => {
      const before = new Date().toISOString();
      const envelope = createEventEnvelope(
        EVENT_TYPES.AGENT_RUN_START,
        { test: true },
        validSource,
      );
      const after = new Date().toISOString();
      expect(envelope.timestamp >= before).toBe(true);
      expect(envelope.timestamp <= after).toBe(true);
    });

    it('should preserve the provided eventType and payload', () => {
      const payload = { foo: 'bar' };
      const envelope = createEventEnvelope(
        EVENT_TYPES.MESSAGE_CREATED,
        payload,
        validSource,
      );
      expect(envelope.eventType).toBe(EVENT_TYPES.MESSAGE_CREATED);
      expect(envelope.payload).toEqual(payload);
    });

    it('should include the provided source', () => {
      const envelope = createEventEnvelope(
        EVENT_TYPES.TOOL_CALL,
        null,
        validSource,
      );
      expect(envelope.source).toEqual(validSource);
    });

    it('should generate unique eventIds for each call', () => {
      const e1 = createEventEnvelope(
        EVENT_TYPES.AGENT_RUN_START,
        null,
        validSource,
      );
      const e2 = createEventEnvelope(
        EVENT_TYPES.AGENT_RUN_START,
        null,
        validSource,
      );
      expect(e1.eventId).not.toBe(e2.eventId);
    });

    it('should generate a traceId if none is provided', () => {
      const envelope = createEventEnvelope(
        EVENT_TYPES.AGENT_RUN_START,
        null,
        validSource,
      );
      expect(envelope.traceId).toBeDefined();
      expect(envelope.traceId.length).toBeGreaterThan(0);
    });
  });
});

describe('EventSourceSchema', () => {
  it('should validate a correct event source', () => {
    const result = EventSourceSchema.safeParse({
      service: 'core-engine',
      instanceId: 'inst-001',
    });
    expect(result.success).toBe(true);
  });

  it('should reject when service is empty', () => {
    const result = EventSourceSchema.safeParse({
      service: '',
      instanceId: 'inst-001',
    });
    expect(result.success).toBe(false);
  });

  it('should reject when instanceId is missing', () => {
    const result = EventSourceSchema.safeParse({ service: 'core-engine' });
    expect(result.success).toBe(false);
  });
});
