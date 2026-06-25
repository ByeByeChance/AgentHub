import { describe, it, expect } from 'vitest';
import { SSETransport } from '../../transport/sse-transport.js';
import { StreamableHTTPTransport } from '../../transport/streamable-http-transport.js';
import { createTransport } from '../../transport/factory.js';
import type { EventEnvelope } from '@agenthub/contracts';

function makeEvent(type: string): EventEnvelope {
  return {
    eventId: crypto.randomUUID(),
    eventType: type,
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    source: { service: 'test', instanceId: 'test-1' },
    payload: { text: 'hello' },
  };
}

function makeReply() {
  const chunks: string[] = [];
  let ended = false;
  const headers = new Map<string, string>();

  return {
    chunks,
    ended: () => ended,
    raw: {
      write(chunk: string) { chunks.push(chunk); return true; },
      end() { ended = true; },
      setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
      getHeader(name: string) { return headers.get(name.toLowerCase()); },
      destroy() { ended = true; },
    },
    headerSent: false,
  };
}

async function* eventGenerator(events: EventEnvelope[]): AsyncGenerator<EventEnvelope> {
  for (const e of events) yield e;
}

describe('TransportStrategy', () => {
  describe('SSETransport', () => {
    it('should have name "sse"', () => {
      expect(new SSETransport().name).toBe('sse');
    });

    it('should set SSE Content-Type header', async () => {
      const transport = new SSETransport();
      const reply = makeReply();
      await transport.streamEvents(eventGenerator([]), reply);
      expect(reply.raw.getHeader('content-type')).toBe('text/event-stream');
    });

    it('should write each event as data: line', async () => {
      const transport = new SSETransport();
      const reply = makeReply();
      const events = [makeEvent('test.one'), makeEvent('test.two')];
      await transport.streamEvents(eventGenerator(events), reply);

      expect(reply.chunks).toHaveLength(2);
      expect(reply.chunks[0]).toMatch(/^data: /);
      expect(reply.chunks[0]).toContain('test.one');
      expect(reply.chunks[0]).toMatch(/\n\n$/);
      expect(reply.chunks[1]).toContain('test.two');
    });

    it('should end the response after streaming', async () => {
      const transport = new SSETransport();
      const reply = makeReply();
      await transport.streamEvents(eventGenerator([]), reply);
      expect(reply.ended()).toBe(true);
    });

    it('should stop on abort signal', async () => {
      const transport = new SSETransport();
      const reply = makeReply();
      const controller = new AbortController();
      // Use a slow generator so abort has time to fire
      async function* slowGenerator(): AsyncGenerator<EventEnvelope> {
        yield makeEvent('test.one');
        await new Promise((r) => setTimeout(r, 20));
        yield makeEvent('test.two');
        await new Promise((r) => setTimeout(r, 20));
        yield makeEvent('test.three');
      }

      const promise = transport.streamEvents(slowGenerator(), reply, controller.signal);
      // Abort after first event but before second
      await new Promise((r) => setTimeout(r, 5));
      controller.abort();
      await promise;

      // Should have at most 1 event written
      expect(reply.chunks.length).toBeLessThanOrEqual(1);
      expect(reply.ended()).toBe(true);
    });
  });

  describe('StreamableHTTPTransport', () => {
    it('should have name "streamable-http"', () => {
      expect(new StreamableHTTPTransport().name).toBe('streamable-http');
    });

    it('should set NDJSON Content-Type', async () => {
      const transport = new StreamableHTTPTransport();
      const reply = makeReply();
      await transport.streamEvents(eventGenerator([]), reply);
      expect(reply.raw.getHeader('content-type')).toBe('application/x-ndjson');
    });

    it('should write each event as JSON line', async () => {
      const transport = new StreamableHTTPTransport();
      const reply = makeReply();
      const events = [makeEvent('test.one'), makeEvent('test.two')];
      await transport.streamEvents(eventGenerator(events), reply);

      expect(reply.chunks).toHaveLength(2);
      expect(reply.chunks[0]).toContain('test.one');
      expect(reply.chunks[0]).not.toMatch(/^data: /);
      expect(reply.chunks[0]).toMatch(/\n$/);
    });
  });

  describe('createTransport factory', () => {
    it('should return SSETransport by default', () => {
      const prev = process.env.TRANSPORT_STRATEGY;
      delete process.env.TRANSPORT_STRATEGY;
      try {
        expect(createTransport().name).toBe('sse');
      } finally {
        if (prev) process.env.TRANSPORT_STRATEGY = prev;
      }
    });

    it('should return StreamableHTTPTransport when env set', () => {
      process.env.TRANSPORT_STRATEGY = 'streamable-http';
      try {
        expect(createTransport().name).toBe('streamable-http');
      } finally {
        delete process.env.TRANSPORT_STRATEGY;
      }
    });

    it('should return SSETransport when env=sse', () => {
      process.env.TRANSPORT_STRATEGY = 'sse';
      try {
        expect(createTransport().name).toBe('sse');
      } finally {
        delete process.env.TRANSPORT_STRATEGY;
      }
    });
  });
});
