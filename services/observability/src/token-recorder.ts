import { randomUUID } from 'node:crypto';
import { TIME_PERIODS, SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import type { ObservabilityDatabase, TokenRecordData } from './repository.interface.js';
import { MODEL_PRICING } from './constants/model-pricing.js';
import { recordTokenSchema, getCostsSchema } from './validation/token-schemas.js';
import type { RecordTokenInput, GetCostsInput } from './validation/token-schemas.js';
import type { CostReport } from './interfaces/token.interface.js';

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
