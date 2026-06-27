/** Default values for service configuration — use as fallbacks when env vars are not set. */
export const SERVICE_DEFAULTS = {
  ports: {
    apiGateway: 3000,
    coreEngine: 3001,
    mcpGateway: 8080,
    skillRegistry: 3002,
    knowledgeBase: 3003,
    observability: 3004,
  },
  host: '0.0.0.0',

  workspace: {
    /** 30 seconds */
    timeout: 30_000,
    /** 10 MB */
    maxBuffer: 10 * 1024 * 1024,
  },

  agentRunner: {
    maxToolRounds: 10,
  },

  embedding: {
    /** Default embedding dimension (DeepSeek / OpenAI text-embedding-3-small) */
    dimension: 1536,
  },

  dbPool: {
    max: 10,
    min: 2,
  },

  cost: {
    /** Decimal places for cost rounding */
    roundingPrecision: 6,
  },
} as const;
