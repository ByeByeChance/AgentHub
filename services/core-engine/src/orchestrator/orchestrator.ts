import type { AgentAdapter, LLMMessage } from '@agenthub/shared/adapter';
import type { ExecutionStrategy, ExecutionContext, TaskNode, TaskResult } from '@agenthub/shared/execution';
import type { EventBus } from '@agenthub/shared/event-bus';
import type { EventSource, EventEnvelope } from '@agenthub/contracts';
import type { Logger } from '@agenthub/shared/logging';
import type { AgentRunner } from '../services/agent-runner.js';
import type { ToolExecutor } from '../services/tool-executor.js';
import type { ConversationService } from '../services/conversation.service.js';
import type { WorkspaceService } from '../services/interfaces/workspace.interface.js';
import type { Database } from '@agenthub/shared/db';
import type { AgentConfig } from '@agenthub/shared/adapter';
import type { TokenRecorderLike, AuditLoggerLike } from '../services/interfaces/agent-runner.interface.js';
import { createEventEnvelope, EVENT_TYPES } from '@agenthub/contracts';
import { parsePlan, type ParsedExecutionPlan } from './plan-parser.js';
import { AGGREGATE_SYSTEM_PROMPT, renderPlanPrompt } from './prompts.js';
import { randomUUID } from 'node:crypto';

export interface OrchestratorInput {
  conversationId: string;
  goal: string;
  messages: LLMMessage[];
  agents: AgentConfig[];
  adapter: AgentAdapter;
  executionStrategy: ExecutionStrategy;
  agentRunner: AgentRunner;
  toolExecutor: ToolExecutor;
  eventBus: EventBus;
  source: EventSource;
  conversationService: ConversationService;
  workspaceService: WorkspaceService;
  db: Database;
  signal: AbortSignal & { aborted: boolean };
  logger: Logger;
  tokenRecorder?: TokenRecorderLike;
  auditLogger?: AuditLoggerLike;
  maxPlanRetries?: number;
}

export interface OrchestratorResult {
  plan: ParsedExecutionPlan;
  results: Record<string, TaskResult>;
  aggregateOutput: string;
  totalTokens: { in: number; out: number };
}

export class Orchestrator {
  /**
   * Execute a multi-agent plan for a user goal.
   *
   * Stage 1 — createPlan:  Ask the LLM to generate an ExecutionPlan from the goal + available agents.
   * Stage 2 — executePlan: Run the plan through the chosen ExecutionStrategy.
   * Stage 3 — aggregateResults: Ask the LLM to synthesize task outputs into a final response.
   */
  async *execute(input: OrchestratorInput): AsyncGenerator<EventEnvelope> {
    const {
      conversationId,
      goal,
      messages,
      agents,
      adapter,
      executionStrategy,
      agentRunner,
      toolExecutor,
      eventBus,
      source,
      conversationService,
      workspaceService,
      db,
      signal,
      logger,
      tokenRecorder,
      auditLogger,
      maxPlanRetries = 3,
    } = input;

    const makeEnvelope = (eventType: string, payload: unknown) =>
      createEventEnvelope(eventType, payload, source);

    // ── Stage 1: createPlan ──
    const planStartEvent = makeEnvelope(EVENT_TYPES.ORCHESTRATOR_PLAN_START, { goal, conversationId });
    eventBus.emit(planStartEvent);
    yield planStartEvent;

    const planSystemPrompt = renderPlanPrompt(agents);

    let plan: ParsedExecutionPlan | null = null;
    let planRetries = 0;

    while (!plan && planRetries < maxPlanRetries) {
      if (signal.aborted) {
        const abortEvent = makeEnvelope(EVENT_TYPES.ORCHESTRATOR_PLAN_FAILED, {
          error: 'Aborted during plan creation',
        });
        eventBus.emit(abortEvent);
        yield abortEvent;
        return;
      }

      try {
        const planMessages: LLMMessage[] = [
          { role: 'system', content: planSystemPrompt },
          ...messages,
          { role: 'user', content: `Create an execution plan for this goal: ${goal}` },
        ];

        let rawOutput = '';
        for await (const chunk of adapter.streamChat(planMessages, [], signal)) {
          if (signal.aborted) break;
          if (chunk.type === 'text_delta') {
            rawOutput += chunk.content;
          }
        }

        // Extract JSON from LLM output (may have markdown fences)
        const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, rawOutput];
        const jsonText = (jsonMatch[1] ?? rawOutput).trim();
        plan = parsePlan(JSON.parse(jsonText));
      } catch (err) {
        planRetries++;
        logger.warn('Plan parsing failed, retrying', {
          attempt: planRetries,
          error: String(err),
        });
      }
    }

    if (!plan) {
      const failEvent = makeEnvelope(EVENT_TYPES.ORCHESTRATOR_PLAN_FAILED, {
        error: `Failed to create a valid plan after ${maxPlanRetries} attempts`,
      });
      eventBus.emit(failEvent);
      yield failEvent;
      return;
    }

    const planCompleteEvent = makeEnvelope(EVENT_TYPES.ORCHESTRATOR_PLAN_COMPLETE, {
      plan,
      conversationId,
    });
    eventBus.emit(planCompleteEvent);
    yield planCompleteEvent;

    // ── Stage 2: executePlan ──
    const taskResults: Record<string, TaskResult> = {};

    // Shared collector that runTask pushes agent-run events into
    const eventBuffer: EventEnvelope[] = [];

    const context: ExecutionContext = {
      signal,
      runTask: async function* (task: TaskNode, taskSignal: AbortSignal) {
        const agentConfig = agents.find((a) => a.id === task.agentId);
        if (!agentConfig) {
          const result: TaskResult = {
            taskId: task.id,
            status: 'failed',
            error: `Agent "${task.agentId}" not found`,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
          taskResults[task.id] = result;
          yield result;
          return;
        }

        const taskMessageId = randomUUID();
        const taskInput = typeof task.input === 'string'
          ? task.input
          : task.input(taskResults);

        const taskMessages: LLMMessage[] = [
          { role: 'system', content: agentConfig.systemPrompt },
          { role: 'user', content: taskInput },
        ];

        const runInput = {
          agentConfig,
          conversationId,
          messages: taskMessages,
          toolExecutor,
          adapter,
          eventBus,
          source,
          conversationService,
          workspaceService,
          db,
          signal: taskSignal,
          maxToolRounds: task.config?.maxRetries,
          logger,
          tokenRecorder,
          auditLogger,
        };

        const runEnumerator = agentRunner.run(runInput, taskMessageId);
        let finalOutput = '';
        let tokensIn = 0;
        let tokensOut = 0;

        for await (const event of runEnumerator) {
          // Collect agent-run events for later forwarding
          eventBuffer.push(event);

          if (event.eventType === EVENT_TYPES.AGENT_RUN_COMPLETE) {
            const payload = event.payload as Record<string, unknown>;
            finalOutput = String(payload.output ?? '');
            const used = payload.tokensUsed as { in?: number; out?: number } | undefined;
            if (used) {
              tokensIn = used.in ?? 0;
              tokensOut = used.out ?? 0;
            }
          }
        }

        const result: TaskResult = {
          taskId: task.id,
          status: 'complete',
          output: finalOutput,
          tokensUsed: { in: tokensIn, out: tokensOut },
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        taskResults[task.id] = result;
        yield result;
      },
    };

    for await (const execEvent of executionStrategy.execute(
      {
        tasks: plan.tasks.map((t) => ({
          id: t.id,
          agentId: t.agentId,
          skillId: t.skillId,
          input: t.input,
          dependsOn: t.dependsOn,
          config: t.config,
        })),
        strategy: plan.strategy,
        globalTimeout: plan.globalTimeout,
        maxConcurrent: plan.maxConcurrent,
      },
      context,
    )) {
      // Flush collected agent-run events before each execution event
      while (eventBuffer.length > 0) {
        yield eventBuffer.shift()!;
      }
      yield makeEnvelope(`orchestrator.task.${execEvent.type.replace('task.', '')}`, execEvent);
    }

    // Flush any remaining agent-run events
    while (eventBuffer.length > 0) {
      yield eventBuffer.shift()!;
    }

    // ── Stage 3: aggregateResults ──
    const taskOutputs = Object.entries(taskResults)
      .map(([id, r]) => `## ${id}\nStatus: ${r.status}\nOutput: ${r.output ?? r.error ?? 'N/A'}`)
      .join('\n\n');

    const aggregateMessages: LLMMessage[] = [
      { role: 'system', content: AGGREGATE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Original goal: ${goal}\n\nTask outputs:\n${taskOutputs}\n\nSynthesize these into a final response.`,
      },
    ];

    let aggregateOutput = '';
    try {
      for await (const chunk of adapter.streamChat(aggregateMessages, [], signal)) {
        if (signal.aborted) break;
        if (chunk.type === 'text_delta') {
          aggregateOutput += chunk.content;
        }
      }
    } catch (err) {
      aggregateOutput = `Aggregation failed: ${String(err)}`;
    }

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    for (const r of Object.values(taskResults)) {
      if (r.tokensUsed) {
        totalTokensIn += r.tokensUsed.in;
        totalTokensOut += r.tokensUsed.out;
      }
    }

    const completeEvent = makeEnvelope(EVENT_TYPES.ORCHESTRATOR_AGGREGATE_COMPLETE, {
      conversationId,
      aggregateOutput,
      taskResults,
      totalTokens: { in: totalTokensIn, out: totalTokensOut },
    });
    eventBus.emit(completeEvent);
    yield completeEvent;
  }
}
