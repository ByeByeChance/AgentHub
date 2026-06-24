import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TIME_PERIODS, SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import type { ObservabilityDatabase, TokenRecordData } from './repository.interface.js';

// ---- Pricing Table (USD per 1K tokens) ----
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-v4-flash': { input: 0.00014, output: 0.00028 },
  'deepseek-v4-pro': { input: 0.00028, output: 0.00112 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-opus-4-8': { input: 0.015, output: 0.075 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
};

// ---- Zod Schemas ----
export const recordTokenSchema = z.object({
  model: z.string().min(1),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  conversationId: z.string().optional(),
  agentId: z.string().optional(),
});

export type RecordTokenInput = z.infer<typeof recordTokenSchema>;

export const getCostsSchema = z.object({
  period: z.enum(TIME_PERIODS).optional().default(TIME_PERIODS[0]),
});

export type GetCostsInput = z.infer<typeof getCostsSchema>;

export interface CostReport {
  period: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

// ---- TokenRecorder ----
export class TokenRecorder {
  constructor(private db: ObservabilityDatabase) {}

  async record(input: RecordTokenInput): Promise<TokenRecordData> {
    const parsed = recordTokenSchema.parse(input);

    const pricing = MODEL_PRICING[parsed.model];
    if (!pricing) {
      throw new UnknownModelError(parsed.model);
    }

    const cost =
      (parsed.tokensIn * pricing.input + parsed.tokensOut * pricing.output) / 1000;

    const record: TokenRecordData = {
      id: randomUUID(),
      model: parsed.model,
      tokensIn: parsed.tokensIn,
      tokensOut: parsed.tokensOut,
      cost: Math.round(cost * 10 ** SERVICE_DEFAULTS.cost.roundingPrecision) / 10 ** SERVICE_DEFAULTS.cost.roundingPrecision,
      conversationId: parsed.conversationId ?? null,
      agentId: parsed.agentId ?? null,
      createdAt: new Date().toISOString(),
    };

    await this.db.tokenRecords.insert(record);
    return record;
  }

  async getCosts(input: GetCostsInput): Promise<CostReport> {
    const parsed = getCostsSchema.parse(input);

    const since = getPeriodSince(parsed.period);
    const records = await this.db.tokenRecords.findByPeriod(since);

    const breakdown = new Map<string, { tokensIn: number; tokensOut: number; cost: number }>();

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCost = 0;

    for (const r of records) {
      totalTokensIn += r.tokensIn;
      totalTokensOut += r.tokensOut;
      totalCost += r.cost;

      const existing = breakdown.get(r.model) ?? { tokensIn: 0, tokensOut: 0, cost: 0 };
      existing.tokensIn += r.tokensIn;
      existing.tokensOut += r.tokensOut;
      existing.cost += r.cost;
      breakdown.set(r.model, existing);
    }

    return {
      period: parsed.period,
      totalTokensIn,
      totalTokensOut,
      totalCost: Math.round(totalCost * 10 ** SERVICE_DEFAULTS.cost.roundingPrecision) / 10 ** SERVICE_DEFAULTS.cost.roundingPrecision,
      breakdown: Array.from(breakdown.entries()).map(([model, data]) => ({
        model,
        ...data,
        cost: Math.round(data.cost * 10 ** SERVICE_DEFAULTS.cost.roundingPrecision) / 10 ** SERVICE_DEFAULTS.cost.roundingPrecision,
      })),
    };
  }
}

function getPeriodSince(period: string): string {
  const now = new Date();
  switch (period) {
    case TIME_PERIODS[0]: // 'daily'
      now.setHours(0, 0, 0, 0);
      break;
    case TIME_PERIODS[1]: // 'weekly'
      now.setDate(now.getDate() - 7);
      break;
    case TIME_PERIODS[2]: // 'monthly'
      now.setMonth(now.getMonth() - 1);
      break;
  }
  return now.toISOString();
}

export class UnknownModelError extends Error {
  constructor(model: string) {
    super(`Unknown model: ${model}. No pricing configured.`);
    this.name = 'UnknownModelError';
  }
}
