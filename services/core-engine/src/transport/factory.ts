import type { TransportStrategy } from '@agenthub/shared/transport';
import { SSETransport } from './sse-transport.js';
import { StreamableHTTPTransport } from './streamable-http-transport.js';

export function createTransport(): TransportStrategy {
  const strategy = process.env.TRANSPORT_STRATEGY ?? 'sse';
  if (strategy === 'streamable-http') return new StreamableHTTPTransport();
  return new SSETransport();
}
