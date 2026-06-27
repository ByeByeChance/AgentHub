/**
 * API version prefix constants.
 *
 * Dual-prefix mode: both the legacy /api/ and the versioned /v1/api/
 * prefixes are active during the transition period.
 */
export const API_V1_PREFIX = '/v1/api';
export const API_LEGACY_PREFIX = '/api';
export const API_PREFIXES = [API_V1_PREFIX, API_LEGACY_PREFIX] as const;

/**
 * Check whether a request URL targets an API route under any active prefix.
 */
export function isApiPath(path: string): boolean {
  return API_PREFIXES.some(
    (prefix) => path.startsWith(prefix + '/') || path === prefix,
  );
}
