import type { FastifyInstance, HTTPMethods } from 'fastify';
import { API_PREFIXES } from '../constants/api-prefix.js';

/**
 * Register a route under ALL active API prefixes (/api/* and /v1/api/*).
 *
 * This keeps handler code identical while supporting both the legacy
 * and versioned URL schemes during the transition period.
 *
 * Usage:
 *   registerApiRoute(app, 'GET', '/agents', handler);
 *   // → serves GET /api/agents AND GET /v1/api/agents
 */
export function registerApiRoute(
  app: FastifyInstance,
  method: HTTPMethods | HTTPMethods[],
  suffix: string,
  handler: Parameters<typeof app.route>[0]['handler'],
): void {
  for (const prefix of API_PREFIXES) {
    app.route({ method, url: `${prefix}${suffix}`, handler });
  }
}
