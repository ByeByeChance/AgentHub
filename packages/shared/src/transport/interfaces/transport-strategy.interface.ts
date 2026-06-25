import type { EventEnvelope } from '@agenthub/contracts';

/** Pluggable transport for streaming EventEnvelope objects to an HTTP response. */
export interface TransportStrategy {
  readonly name: string;

  /**
   * Stream events from an async generator to an HTTP reply.
   * The transport implementation owns the wire format (SSE, chunked JSON, etc.).
   *
   * @param events - Async generator yielding EventEnvelope objects.
   * @param reply - The raw Node.js ServerResponse to write to.
   * @param signal - Optional AbortSignal for client disconnect.
   */
  streamEvents(
    events: AsyncGenerator<EventEnvelope>,
    reply: TransportReply,
    signal?: AbortSignal,
  ): Promise<void>;
}

/** Minimal interface for the underlying HTTP response object (framework-agnostic). */
export interface TransportReply {
  raw: {
    write(chunk: string): boolean;
    end(): void;
    setHeader(name: string, value: string): void;
    getHeader(name: string): string | string[] | undefined;
    destroy(): void;
  };

  /** Indicate that headers have been sent (prevent further setHeader calls). */
  headerSent: boolean;
}
