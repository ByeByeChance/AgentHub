/**
 * @fileoverview SSE stream parser — reads a ReadableStream<Uint8Array>,
 * splits lines by SSE protocol, and dispatches parsed EventEnvelope objects
 * via a callback. Pure function, usable from Zustand actions or hooks.
 */

import type { EventEnvelope } from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * Parse an SSE stream and invoke `onEvent` for each parsed EventEnvelope.
 *
 * Returns when the stream ends or is aborted. The caller should handle
 * AbortError and call finalize logic after this resolves/rejects.
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: EventEnvelope) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr) as EventEnvelope;
            onEvent(event);
          } catch {
            logger.warn('Failed to parse SSE line', { line: trimmed });
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
