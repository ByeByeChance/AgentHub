/** Pricing Table (USD per 1K tokens) */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-v4-flash': { input: 0.00014, output: 0.00028 },
  'deepseek-v4-pro': { input: 0.00028, output: 0.00112 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-opus-4-8': { input: 0.015, output: 0.075 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
};
