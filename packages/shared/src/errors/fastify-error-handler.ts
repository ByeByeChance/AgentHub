import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ProblemDetail } from './problem-detail.js';
import { ERROR_TYPES } from './error-codes.js';

/**
 * Register a global Fastify error handler that produces RFC 9457
 * `application/problem+json` responses for all error types.
 *
 * - `ProblemDetail` → serializes its `toJSON()` as-is
 * - `SafetyNetBlockedError` (name-based detection) → maps gate statusCode (402/429/503)
 * - Other `Error` → 500 with sanitized detail (production-safe)
 *
 * Must be called BEFORE `app.listen()`.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | Error, _request: FastifyRequest, reply: FastifyReply) => {
      const err = error as Error & { validation?: unknown[]; statusCode?: number };

      // Case 1: ProblemDetail — our standard error, render as-is
      if (err instanceof ProblemDetail) {
        return reply
          .code(err.status)
          .header('Content-Type', 'application/problem+json')
          .send(err.toJSON());
      }

      // Case 2: SafetyNetBlockedError — gate blocked the request
      // Detected by name to avoid importing from core-engine into shared
      if (err.name === 'SafetyNetBlockedError' && 'result' in err) {
        const result = (err as unknown as {
          result: { allowed: false; statusCode?: number; reason?: string; blockedBy?: string };
        }).result;
        const pd = ProblemDetail.fromSafetyNet(
          { allowed: false, statusCode: result.statusCode, reason: result.reason, blockedBy: result.blockedBy as 'rate_limiter' | 'cost_guard' | 'circuit_breaker' | undefined },
          _request.url,
        );
        return reply
          .code(pd.status)
          .header('Content-Type', 'application/problem+json')
          .send(pd.toJSON());
      }

      // Case 3: Fastify validation error (built-in schema validation)
      if (err.validation) {
        const pd = new ProblemDetail({
          type: ERROR_TYPES.VALIDATION_ERROR,
          title: 'Validation Error',
          status: 400,
          detail: 'Request validation failed',
          instance: _request.url,
          errors: err.validation,
        });
        return reply
          .code(400)
          .header('Content-Type', 'application/problem+json')
          .send(pd.toJSON());
      }

      // Case 4: Unhandled error — 500, sanitized
      const isProduction = process.env.NODE_ENV === 'production';
      const pd = new ProblemDetail({
        type: ERROR_TYPES.INTERNAL_ERROR,
        title: 'Internal Server Error',
        status: 500,
        detail: isProduction ? 'An unexpected error occurred' : err.message,
        instance: _request.url,
      });

      // Log the full error for diagnostics
      app.log.error({ err, instance: _request.url }, 'Unhandled error');

      return reply
        .code(500)
        .header('Content-Type', 'application/problem+json')
        .send(pd.toJSON());
    },
  );
}
