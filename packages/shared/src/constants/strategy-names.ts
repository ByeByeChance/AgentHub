/** Strategy identifiers used to select implementations via env vars or factory functions. */
export const STRATEGY_NAMES = {
  ADAPTERS: ['deepseek', 'mock'] as const,
  EMBEDDING: ['deepseek', 'mock'] as const,
  CHUNKING: ['recursive', 'mock'] as const,
  VECTOR_BACKENDS: ['pgvector', 'inmemory'] as const,
  QUEUE_BACKENDS: ['rabbitmq', 'redis', 'nats', 'mock'] as const,
  AUTH: ['api-key', 'oauth2', 'mtls', 'noop'] as const,
  TRANSPORT: ['sse', 'streamable-http'] as const,
  EXECUTION: ['dag', 'sequential', 'parallel'] as const,
} as const;

export type AdapterName = (typeof STRATEGY_NAMES.ADAPTERS)[number];
export type EmbeddingStrategyName = (typeof STRATEGY_NAMES.EMBEDDING)[number];
export type ChunkingStrategyName = (typeof STRATEGY_NAMES.CHUNKING)[number];
export type VectorBackendName = (typeof STRATEGY_NAMES.VECTOR_BACKENDS)[number];
export type QueueBackendName = (typeof STRATEGY_NAMES.QUEUE_BACKENDS)[number];
export type AuthStrategyName = (typeof STRATEGY_NAMES.AUTH)[number];
export type TransportStrategyName = (typeof STRATEGY_NAMES.TRANSPORT)[number];
export type ExecutionStrategyName = (typeof STRATEGY_NAMES.EXECUTION)[number];
