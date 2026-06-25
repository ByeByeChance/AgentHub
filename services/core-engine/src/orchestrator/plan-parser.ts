import { z } from 'zod';

/**
 * Zod schema for validating LLM-generated execution plans.
 *
 * The LLM outputs a JSON plan that must conform to this schema.
 * Any deviation results in a validation error that the orchestrator
 * can feed back to the LLM for correction (up to a configurable
 * number of retry rounds).
 */

const taskNodeSchema = z.object({
  id: z.string().min(1).describe('Unique task identifier'),
  agentId: z.string().min(1).describe('Agent ID to execute this task'),
  skillId: z.string().optional().describe('Optional skill ID to invoke'),
  input: z.string().min(1).describe('Task input / prompt text'),
  dependsOn: z
    .array(z.string())
    .default([])
    .describe('IDs of tasks that must complete before this one'),
  config: z
    .object({
      maxRetries: z.number().int().positive().optional(),
      timeout: z.number().int().positive().optional(),
      modelId: z.string().optional(),
    })
    .optional()
    .describe('Optional task-level configuration overrides'),
});

export type ParsedTaskNode = z.infer<typeof taskNodeSchema>;

export const executionPlanSchema = z.object({
  tasks: z
    .array(taskNodeSchema)
    .min(1)
    .describe('Ordered list of tasks to execute'),
  strategy: z
    .enum(['dag', 'sequential', 'parallel'])
    .default('dag')
    .describe('Execution strategy'),
  globalTimeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Global timeout in milliseconds'),
  maxConcurrent: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max concurrent tasks within a wave'),
});

export type ParsedExecutionPlan = z.infer<typeof executionPlanSchema>;

/**
 * Parse and validate a raw LLM output into a structured execution plan.
 * Throws ZodError on validation failure (caught by orchestrator for retry).
 */
export function parsePlan(raw: unknown): ParsedExecutionPlan {
  return executionPlanSchema.parse(raw);
}
