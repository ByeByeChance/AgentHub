/**
 * Service URL resolution — pluggable service discovery strategies.
 *
 * Strategy pattern:
 *   - 'env':  reads from static environment variables (CORE_ENGINE_URL, etc.).
 *             This is the default and works everywhere.
 *   - 'dns':  resolves service names using Docker Compose / Kubernetes DNS.
 *             e.g. "core-engine" → "http://core-engine:3001"
 *
 * Usage:
 *   const url = resolveServiceUrl('core-engine');
 *   // → 'http://localhost:3001' (env strategy) or 'http://core-engine:3001' (dns)
 */

export type ServiceDiscoveryStrategy = 'env' | 'dns';

/** Well-known service names in the AgentHub topology. */
export type ServiceName =
  | 'core-engine'
  | 'mcp-gateway'
  | 'skill-registry'
  | 'knowledge-base'
  | 'observability';

/** Port each service listens on (must match SERVICE_DEFAULTS.ports). */
const SERVICE_PORTS: Record<ServiceName, number> = {
  'core-engine':      3001,
  'mcp-gateway':      8080,
  'skill-registry':   3002,
  'knowledge-base':   3003,
  'observability':    3004,
};

/** Env var name for each service's URL. */
const ENV_VAR_NAMES: Record<ServiceName, string> = {
  'core-engine':      'CORE_ENGINE_URL',
  'mcp-gateway':      'MCP_GATEWAY_URL',
  'skill-registry':   'SKILL_REGISTRY_URL',
  'knowledge-base':   'KNOWLEDGE_BASE_URL',
  'observability':    'OBSERVABILITY_URL',
};

/** Default host for local development. */
const DEFAULT_HOST = 'http://localhost';

/**
 * Resolve the URL for a service using the configured discovery strategy.
 *
 * @param service   Service name
 * @param strategy  Discovery strategy (defaults to SERVICE_DISCOVERY env var or 'env')
 * @returns Resolved URL (always ends without trailing slash)
 */
export function resolveServiceUrl(
  service: ServiceName,
  strategy?: ServiceDiscoveryStrategy,
): string {
  const mode = strategy ?? (process.env.SERVICE_DISCOVERY as ServiceDiscoveryStrategy | undefined) ?? 'env';

  switch (mode) {
    case 'dns':
      // Docker Compose service name resolution
      return `http://${service}:${SERVICE_PORTS[service]}`;
    case 'env':
    default:
      // Static environment variable
      return process.env[ENV_VAR_NAMES[service]]
        ?? `${DEFAULT_HOST}:${SERVICE_PORTS[service]}`;
  }
}

/**
 * Resolve all service URLs at once (useful for logging and health checks).
 */
export function resolvedServiceUrls(
  strategy?: ServiceDiscoveryStrategy,
): Record<ServiceName, string> {
  const services: ServiceName[] = [
    'core-engine',
    'mcp-gateway',
    'skill-registry',
    'knowledge-base',
    'observability',
  ];
  const result = {} as Record<ServiceName, string>;
  for (const svc of services) {
    result[svc] = resolveServiceUrl(svc, strategy);
  }
  return result;
}
