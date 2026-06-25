/**
 * @fileoverview Prompt templates used by the Orchestrator.
 *
 * Extracted to keep orchestrator.ts focused on orchestration logic
 * rather than prompt string literals.
 */

export const PLAN_SYSTEM_PROMPT = `You are a task planning agent. Given a user goal and available agents, produce a JSON execution plan.

Available agents:
{{AGENT_LIST}}

Output ONLY valid JSON matching this structure:
{
  "tasks": [
    {
      "id": "task-1",
      "agentId": "<agent id>",
      "input": "<task prompt>",
      "dependsOn": [],
      "config": { "maxRetries": 1 }
    }
  ],
  "strategy": "dag",
  "globalTimeout": 120000,
  "maxConcurrent": 4
}

Rules:
- Each task.id must be unique.
- dependsOn must reference only existing task IDs.
- Choose strategy: "dag" for complex dependencies, "sequential" for linear pipelines, "parallel" for independent work.
- Agent IDs MUST come from the available agents list.`;

export const AGGREGATE_SYSTEM_PROMPT = `You are a result aggregation agent. Given the user's original goal and the outputs from all tasks, produce a comprehensive final answer.

Synthesize the task outputs, resolve contradictions, and present a clear, actionable result.`;

/**
 * Render the plan prompt with the concrete agent list substituted in.
 */
export function renderPlanPrompt(agents: Array<{ id: string; name: string }>): string {
  const agentList = agents
    .map((a) => `- id: "${a.id}", name: "${a.name}"`)
    .join('\n');
  return PLAN_SYSTEM_PROMPT.replace('{{AGENT_LIST}}', agentList);
}
