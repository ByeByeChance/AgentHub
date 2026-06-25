/** Result of an authentication attempt. */
export interface AuthResult {
  authenticated: boolean;
  identity?: {
    clientId: string;
    scopes: string[];
  };
  error?: string;
}

/**
 * Pluggable authentication strategy.
 *
 * Implementations validate credentials from an incoming HTTP request
 * and return a structured AuthResult.
 */
export interface AuthStrategy {
  readonly name: string;

  /**
   * Authenticate a request.
   *
   * @param request - The incoming HTTP request (framework-agnostic headers object).
   * @returns AuthResult indicating whether the request is authenticated.
   */
  authenticate(request: AuthRequest): Promise<AuthResult>;
}

/** Minimal framework-agnostic request representation for auth. */
export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
}
