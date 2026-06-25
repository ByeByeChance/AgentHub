import type {
  ExecutionStrategy, ExecutionPlan, ExecutionContext, ExecutionEvent, TaskNode, TaskResult,
} from '@agenthub/shared/execution';

export class SequentialExecutor implements ExecutionStrategy {
  readonly name = 'sequential';

  async *execute(plan: ExecutionPlan, context: ExecutionContext): AsyncGenerator<ExecutionEvent> {
    const { tasks, globalTimeout } = plan;
    const results: Record<string, TaskResult> = {};
    const sorted = this.topoSort(tasks);
    if (!sorted) {
      yield { type: 'plan.failed', error: 'Cycle detected in task dependency graph' };
      return;
    }

    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (globalTimeout) timeoutId = setTimeout(() => abortController.abort(), globalTimeout);
    const onAbort = (): void => abortController.abort();
    context.signal.addEventListener('abort', onAbort);

    let failed = false;

    try {
      for (const task of sorted) {
        if (abortController.signal.aborted || failed) break;

        const input = typeof task.input === 'function' ? task.input(results) : task.input;
        yield { type: 'task.start', taskId: task.id, agentId: task.agentId };

        try {
          const gen = context.runTask({ ...task, input }, abortController.signal);
          let last: TaskResult = { taskId: task.id, status: 'running', startedAt: new Date().toISOString() };
          for await (const p of gen) last = p;
          last.status = 'complete';
          last.completedAt = new Date().toISOString();
          results[task.id] = last;
          yield { type: 'task.complete', taskId: task.id, result: last };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          results[task.id] = { taskId: task.id, status: 'failed', error };
          failed = true;
          yield { type: 'task.failed', taskId: task.id, error };
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

  private topoSort(tasks: TaskNode[]): TaskNode[] | null {
    const m = new Map(tasks.map((t) => [t.id, t]));
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const t of tasks) {
      if (!indeg.has(t.id)) indeg.set(t.id, 0);
      for (const d of t.dependsOn) {
        if (!adj.has(d)) adj.set(d, []);
        adj.get(d)!.push(t.id);
        indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1);
      }
    }
    const q: TaskNode[] = [];
    for (const t of tasks) if ((indeg.get(t.id) ?? 0) === 0) q.push(t);
    const sorted: TaskNode[] = [];
    while (q.length > 0) {
      const cur = q.shift()!;
      sorted.push(cur);
      for (const nid of adj.get(cur.id) ?? []) {
        const d = (indeg.get(nid) ?? 1) - 1;
        indeg.set(nid, d);
        if (d === 0) q.push(m.get(nid)!);
      }
    }
    return sorted.length === tasks.length ? sorted : null;
  }
}
