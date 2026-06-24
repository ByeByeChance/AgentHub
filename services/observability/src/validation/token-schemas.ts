import { z } from 'zod';
import { TIME_PERIODS } from '@agenthub/shared/constants';

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
