import { ERROR_TYPES, errorTypeForSafetyNetGate } from './error-codes.js';

/**
 * Minimal interface for SafetyNet blocking results — avoids importing
 * from core-engine into shared (dependency direction).
 */
export interface SafetyNetBlockResult {
  allowed: false;
  statusCode?: number;
  reason?: string;
  blockedBy?: 'rate_limiter' | 'cost_guard' | 'circuit_breaker';
}

/**
 * RFC 9457 Problem Detail fields.
 *
 * The `type` field is a URI identifying the problem category.
 * The `instance` field is a URI identifying the specific occurrence (typically the request path).
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9457
 */
export interface ProblemDetailFields {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  /** Extension: validation error details (Zod issues, etc.) */
  errors?: unknown[];
  /** Extension: which SafetyNet gate blocked the request */
  blockedBy?: string;
}

/**
 * RFC 9457 Problem Detail — an Error subclass that serializes to the
 * standard `application/problem+json` body shape.
 *
 * Usage in route handlers:
 *   throw new ProblemDetail({ type: ERROR_TYPES.NOT_FOUND, title: 'Not Found', status: 404, detail: 'Agent not found' });
 *
 * The global Fastify error handler catches this and renders `toJSON()`.
 */
export class ProblemDetail extends Error {
  public readonly type: string;
  public readonly title: string;
  public readonly status: number;
  public readonly detail: string;
  public readonly instance?: string;
  public readonly extensions: Record<string, unknown>;

  constructor(fields: ProblemDetailFields) {
    super(fields.title); // for Error.prototype.stack
    this.name = 'ProblemDetail';
    this.type = fields.type;
    this.title = fields.title;
    this.status = fields.status;
    this.detail = fields.detail;
    this.instance = fields.instance;
    this.extensions = {};

    if (fields.errors) this.extensions.errors = fields.errors;
    if (fields.blockedBy) this.extensions.blockedBy = fields.blockedBy;
  }

  /** Serialize to RFC 9457 JSON body (Fastify calls this via setErrorHandler). */
  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: this.instance,
      ...this.extensions,
    };
  }

  // ── factories ──

  /**
   * Create a ProblemDetail from a Zod validation error.
   * Extracts issue details into the `errors` extension field.
   */
  static fromZodError(
    zodError: { issues: Array<{ message: string; path: (string | number)[]; code: string }> },
    instance?: string,
  ): ProblemDetail {
    return new ProblemDetail({
      type: ERROR_TYPES.VALIDATION_ERROR,
      title: 'Validation Error',
      status: 400,
      detail: `Request validation failed: ${zodError.issues.length} issue(s)`,
      instance,
      errors: zodError.issues.map((i) => ({
        message: i.message,
        path: i.path,
        code: i.code,
      })),
    });
  }

  /**
   * Create a ProblemDetail from a SafetyNet blocking result.
   * Maps the gate name to the appropriate error type URI.
   */
  static fromSafetyNet(
    result: SafetyNetBlockResult,
    instance?: string,
  ): ProblemDetail {
    return new ProblemDetail({
      type: errorTypeForSafetyNetGate(result.blockedBy ?? 'circuit_breaker'),
      title: result.reason ?? 'Request blocked',
      status: result.statusCode ?? 500,
      detail: result.reason ?? 'Request blocked by safety net',
      instance,
      blockedBy: result.blockedBy,
    });
  }
}
