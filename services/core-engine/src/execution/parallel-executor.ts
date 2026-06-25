import type {
  ExecutionStrategy, ExecutionPlan, ExecutionContext, ExecutionEvent, TaskResult,
} from '@agenthub/shared/execution';

export class ParallelExecutor implements ExecutionStrategy {
  readonly name = 'parallel';

  async *execute(plan: ExecutionPlan, context: ExecutionContext): AsyncGenerator<ExecutionEvent> {
    const { tasks, maxConcurrent = 4, globalTimeout } = plan;
    const results: Record<string, TaskResult> = {};
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (globalTimeout) timeoutId = setTimeout(() => abortController.abort(), globalTimeout);
    const onAbort = (): void => abortController.abort();
    context.signal.addEventListener('abort', onAbort);

    let failed = false;
    let index = 0;

    try {
      while (index < tasks.length && !abortController.signal.aborted && !failed) {
        const batch = tasks.slice(index, index + maxConcurrent);
        index += maxConcurrent;

        for (const task of batch) {
          yield { type: 'task.start', taskId: task.id, agentId: task.agentId };
        }

        const batchResults = await Promise.all(batch.map(async (task) => {
          try {
            const gen = context.runTask(task, abortController.signal);
            let last: TaskResult = { taskId: task.id, status: 'running', startedAt: new Date().toISOString() };
            for await (const p of gen) last = p;
            last.status = 'complete';
            last.completedAt = new Date().toISOString();
            return { ok: true as const, taskId: task.id, result: last };
          } catch (err) {
            return {
              ok: false as const,
              taskId: task.id,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }));

        for (const r of batchResults) {
          if (r.ok) {
            results[r.taskId] = r.result;
            yield { type: 'task.complete', taskId: r.taskId, result: r.result };
          } else {
            results[r.taskId] = { taskId: r.taskId, status: 'failed', error: r.error };
            failed = true;
            yield { type: 'task.failed', taskId: r.taskId, error: r.error };
          }
        }
      }

      yield failed
        ? { type: 'plan.failed', error: 'One or more tasks failed' }
        : { type: 'plan.complete', results };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      context.signal.removeEventListener('abort', onAbort);
    }
  }
}
