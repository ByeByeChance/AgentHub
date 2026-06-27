/**
 * Well-known RFC 9457 problem type URIs for the AgentHub domain.
 *
 * Format: `urn:agenthub:<category>#<name>`
 * These serve as machine-readable identifiers so API consumers can
 * programmatically distinguish error conditions.
 */
export const ERROR_TYPES = {
  // Validation
  VALIDATION_ERROR: 'urn:agenthub:validation#validation-error',

  // Auth
  UNAUTHORIZED: 'urn:agenthub:auth#unauthorized',

  // Reliability (SafetyNet gates)
  RATE_LIMITED: 'urn:agenthub:reliability#rate-limited',
  COST_LIMIT_EXCEEDED: 'urn:agenthub:reliability#cost-limit-exceeded',
  CIRCUIT_OPEN: 'urn:agenthub:reliability#circuit-open',

  // Resource
  NOT_FOUND: 'urn:agenthub:resource#not-found',
  CONFLICT: 'urn:agenthub:resource#conflict',

  // Infrastructure
  SERVICE_UNAVAILABLE: 'urn:agenthub:infra#service-unavailable',
  BAD_GATEWAY: 'urn:agenthub:infra#bad-gateway',
  INTERNAL_ERROR: 'urn:agenthub:infra#internal-error',
} as const;

export type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

/**
 * Map a SafetyNet "blockedBy" gate name to its corresponding error type URI.
 */
export function errorTypeForSafetyNetGate(
  blockedBy: 'rate_limiter' | 'cost_guard' | 'circuit_breaker',
): string {
  switch (blockedBy) {
    case 'rate_limiter':
      return ERROR_TYPES.RATE_LIMITED;
    case 'cost_guard':
      return ERROR_TYPES.COST_LIMIT_EXCEEDED;
    case 'circuit_breaker':
      return ERROR_TYPES.CIRCUIT_OPEN;
  }
}
