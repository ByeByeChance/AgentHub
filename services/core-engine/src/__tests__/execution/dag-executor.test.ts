import { describe, it, expect, afterEach } from 'vitest';
import { DAGExecutor } from '../../execution/dag-executor.js';
import { SequentialExecutor } from '../../execution/sequential-executor.js';
import { ParallelExecutor } from '../../execution/parallel-executor.js';
import { createExecutionStrategy } from '../../execution/factory.js';
import type {
  ExecutionPlan, ExecutionContext, ExecutionEvent,
} from '@agenthub/shared/execution';

/** Create a simple runTask that respects task input in the output. */
function makeContext(delayMs = 1): ExecutionContext {
  return {
    signal: new AbortController().signal,
    runTask: async function* (task, _signal) {
      await new Promise((r) => setTimeout(r, delayMs));
      yield { taskId: task.id, status: 'running' as const, startedAt: new Date().toISOString() };
      yield {
        taskId: task.id,
        status: 'complete' as const,
        output: typeof task.input === 'string' ? task.input : `output-${task.id}`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    },
  };
}

/** Collect all events from an async generator. */
async function collect(gen: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe('ExecutionStrategy', () => {
  describe('DAGExecutor', () => {
    it('should have name "dag"', () => {
      expect(new DAGExecutor().name).toBe('dag');
    });

    it('should detect cycles and return plan.failed', async () => {
      const plan: ExecutionPlan = {
        tasks: [
          { id: 'a', agentId: 'agent-1', input: 'x', dependsOn: ['b'] },
          { id: 'b', agentId: 'agent-1', input: 'y', dependsOn: ['a'] },
        ],
        strategy: 'dag',
      };
      const events = await collect(new DAGExecutor().execute(plan, makeContext()));
      expect(events[0]?.type).toBe('plan.failed');
      expect(events[0]?.type === 'plan.failed' && events[0].error).toContain('Cycle');
    });

    it('should execute a linear chain A -> B -> C in order', async () => {
      const plan: ExecutionPlan = {
        tasks: [
          { id: 'a', agentId: 'agent-1', input: 'task A', dependsOn: [] },
          { id: 'b', agentId: 'agent-2', input: 'task B', dependsOn: ['a'] },
          { id: 'c', agentId: 'agent-3', input: 'task C', dependsOn: ['b'] },
        ],
        strategy: 'dag',
      };
      const events = await collect(new DAGExecutor().execute(plan, makeContext()));
      const completeEvents = events.filter((e) => e.type === 'task.complete');
      expect(completeEvents).toHaveLength(3);
      expect(completeEvents[0]?.type === 'task.complete' && completeEvents[0].taskId).toBe('a');
      expect(completeEvents[1]?.type === 'task.complete' && completeEvents[1].taskId).toBe('b');
      expect(completeEvents[2]?.type === 'task.complete' && completeEvents[2].taskId).toBe('c');
      expect(events[events.length - 1]?.type).toBe('plan.complete');
    });

    it('should execute diamond A -> [B,C] -> D with B/C parallel', async () => {
      const plan: ExecutionPlan = {
        tasks: [
          { id: 'a', agentId: 'agent-1', input: 'start', dependsOn: [] },
          { id: 'b', agentId: 'agent-2', input: 'branch1', dependsOn: ['a'] },
          { id: 'c', agentId: 'agent-3', input: 'branch2', dependsOn: ['a'] },
          { id: 'd', agentId: 'agent-4', input: (r) => `merge ${r.b?.output} ${r.c?.output}`, dependsOn: ['b', 'c'] },
        ],
        strategy: 'dag',
      };

      const events = await collect(new DAGExecutor().execute(plan, makeContext(5)));
      const completeEvents = events.filter((e) => e.type === 'task.complete');

      expect(completeEvents).toHaveLength(4);
      // A must be first
      expect(completeEvents[0]?.type === 'task.complete' && completeEvents[0].taskId).toBe('a');

      // B and C complete before D
      const dEvent = completeEvents.find((e) => e.type === 'task.complete' && e.taskId === 'd');
      expect(dEvent).toBeDefined();
      expect(dEvent?.type === 'task.complete' && dEvent.result.output).toContain('branch1');
      expect(dEvent?.type === 'task.complete' && dEvent.result.output).toContain('branch2');

      expect(events[events.length - 1]?.type).toBe('plan.complete');
    });

    it('should respect maxConcurrent limit', async () => {
      // 4 independent tasks with maxConcurrent=2
      const tasks = [0, 1, 2, 3].map((i) => ({
        id: `task-${i}`,
        agentId: 'agent',
        input: `input-${i}`,
        dependsOn: [] as string[],
      }));

      const plan: ExecutionPlan = { tasks, strategy: 'dag', maxConcurrent: 2 };

      let maxConcurrent = 0;
      let running = 0;
      const ctx: ExecutionContext = {
        signal: new AbortController().signal,
        runTask: async function* (task, _signal) {
          running++;
          maxConcurrent = Math.max(maxConcurrent, running);
          await new Promise((r) => setTimeout(r, 10));
          yield { taskId: task.id, status: 'running' as const };
          yield { taskId: task.id, status: 'complete' as const, output: `out-${task.id}` };
          running--;
        },
      };

      await collect(new DAGExecutor().execute(plan, ctx));
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should fail plan when a task fails', async () => {
      const plan: ExecutionPlan = {
        tasks: [
          { id: 'a', agentId: 'agent-1', input: 'ok', dependsOn: [] },
          { id: 'b', agentId: 'agent-2', input: 'fail', dependsOn: ['a'] },
        ],
        strategy: 'dag',
      };

      const ctx: ExecutionContext = {
        signal: new AbortController().signal,
        runTask: async function* (task, _signal) {
          if (task.id === 'b') throw new Error('task B failed');
          yield { taskId: task.id, status: 'complete' as const, output: 'ok' };
        },
      };

      const events = await collect(new DAGExecutor().execute(plan, ctx));
      const failedEvent = events.find((e) => e.type === 'task.failed');
      expect(failedEvent).toBeDefined();
      expect(events[events.length - 1]?.type).toBe('plan.failed');
    });
  });

  describe('SequentialExecutor', () => {
    it('should have name "sequential"', () => {
      expect(new SequentialExecutor().name).toBe('sequential');
    });

    it('should execute tasks one at a time in order', async () => {
      const plan: ExecutionPlan = {
        tasks: [
          { id: 'x', agentId: 'a', input: '1', dependsOn: [] },
          { id: 'y', agentId: 'b', input: '2', dependsOn: [] },
          { id: 'z', agentId: 'c', input: '3', dependsOn: [] },
        ],
        strategy: 'sequential',
      };
      const events = await collect(new SequentialExecutor().execute(plan, makeContext()));
      const complete = events.filter((e) => e.type === 'task.complete');
      expect(complete).toHaveLength(3);
      expect(events[events.length - 1]?.type).toBe('plan.complete');
    });
  });

  describe('ParallelExecutor', () => {
    it('should have name "parallel"', () => {
      expect(new ParallelExecutor().name).toBe('parallel');
    });

    it('should execute all tasks concurrently within maxConcurrent', async () => {
      const tasks = [0, 1, 2].map((i) => ({
        id: `p-${i}`,
        agentId: 'agent',
        input: `in-${i}`,
        dependsOn: [] as string[],
      }));
      const plan: ExecutionPlan = { tasks, strategy: 'parallel', maxConcurrent: 2 };
      const events = await collect(new ParallelExecutor().execute(plan, makeContext()));
      const complete = events.filter((e) => e.type === 'task.complete');
      expect(complete).toHaveLength(3);
      expect(events[events.length - 1]?.type).toBe('plan.complete');
    });
  });

  describe('createExecutionStrategy factory', () => {
    afterEach(() => { delete process.env.EXECUTION_STRATEGY; });

    it('should return DAGExecutor by default', () => {
      expect(createExecutionStrategy().name).toBe('dag');
    });

    it('should return SequentialExecutor when env=sequential', () => {
      process.env.EXECUTION_STRATEGY = 'sequential';
      expect(createExecutionStrategy().name).toBe('sequential');
    });

    it('should return ParallelExecutor when env=parallel', () => {
      process.env.EXECUTION_STRATEGY = 'parallel';
      expect(createExecutionStrategy().name).toBe('parallel');
    });
  });
});
