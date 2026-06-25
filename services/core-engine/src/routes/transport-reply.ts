import type { FastifyReply } from 'fastify';
import type { TransportReply } from '@agenthub/shared/transport';

/**
 * Adapt a Fastify reply into the framework-agnostic TransportReply.
 *
 * Wraps the raw Node.js ServerResponse so it conforms to the
 * TransportReply interface expected by all TransportStrategy implementations.
 */
export function toTransportReply(reply: FastifyReply): TransportReply {
  return {
    raw: {
      write(chunk: string): boolean {
        return reply.raw.write(chunk);
      },
      end(): void {
        reply.raw.end();
      },
      setHeader(name: string, value: string): void {
        reply.raw.setHeader(name, value);
      },
      getHeader(name: string): string | string[] | undefined {
        const value = reply.raw.getHeader(name);
        // Node.js getHeader can return number for numeric headers (e.g. Content-Length);
        // TransportReply only deals with string-typed headers (Content-Type, etc.).
        if (typeof value === 'number') return String(value);
        return value;
      },
      destroy(): void {
        reply.raw.destroy();
      },
    },
    get headerSent(): boolean {
      return reply.raw.headersSent;
    },
  };
}
