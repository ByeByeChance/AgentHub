import type {
  ExecutionStrategy,
  ExecutionPlan,
  ExecutionContext,
  ExecutionEvent,
  TaskNode,
  TaskResult,
} from '@agenthub/shared/execution';

/**
 * DAG executor: topological sort → level-based wave grouping → parallel within waves.
 */
export class DAGExecutor implements ExecutionStrategy {
  readonly name = 'dag';

  async *execute(plan: ExecutionPlan, context: ExecutionContext): AsyncGenerator<ExecutionEvent> {
    const { tasks, maxConcurrent = 4, globalTimeout } = plan;
    const results: Record<string, TaskResult> = {};

    for (const task of tasks) {
      results[task.id] = { taskId: task.id, status: 'pending' };
    }

    const { sorted, levels } = this.topoSort(tasks);
    if (!sorted) {
      yield { type: 'plan.failed', error: 'Cycle detected in task dependency graph' };
      return;
    }

    const waves = this.groupByLevel(sorted, levels);
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (globalTimeout) timeoutId = setTimeout(() => abortController.abort(), globalTimeout);
    const onParentAbort = (): void => abortController.abort();
    context.signal.addEventListener('abort', onParentAbort);

    let failed = false;

    try {
      for (const wave of waves) {
        if (abortController.signal.aborted || failed) break;

        const waveEvents = await this.executeWave(
          wave, results, context, abortController.signal, maxConcurrent,
        );

        for (const event of waveEvents) {
          if (event.type === 'task.complete') {
            results[event.taskId] = event.result;
          } else if (event.type === 'task.failed') {
            results[event.taskId] = { taskId: event.taskId, status: 'failed', error: event.error };
            failed = true;
            abortController.abort();
          }
          yield event;
        }
      }

      yield failed
        ? { type: 'plan.failed', error: 'One or more tasks failed' }
        : { type: 'plan.complete', results };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      context.signal.removeEventListener('abort', onParentAbort);
    }
  }

  private async executeWave(
    tasks: TaskNode[],
    results: Record<string, TaskResult>,
    context: ExecutionContext,
    signal: AbortSignal,
    maxConcurrent: number,
  ): Promise<ExecutionEvent[]> {
    const events: ExecutionEvent[] = [];
    let index = 0;

    while (index < tasks.length && !signal.aborted) {
      const batch = tasks.slice(index, index + maxConcurrent);
      index += maxConcurrent;

      await Promise.all(batch.map(async (task) => {
        const resolvedInput = typeof task.input === 'function' ? task.input(results) : task.input;
        const resolvedTask: TaskNode = { ...task, input: resolvedInput };

        events.push({ type: 'task.start', taskId: task.id, agentId: task.agentId });

        try {
          const gen = context.runTask(resolvedTask, signal);
          let lastResult: TaskResult = { taskId: task.id, status: 'running', startedAt: new Date().toISOString() };

          for await (const partial of gen) {
            lastResult = partial;
          }

          lastResult.status = 'complete';
          lastResult.completedAt = new Date().toISOString();
          results[task.id] = lastResult;
          events.push({ type: 'task.complete', taskId: task.id, result: lastResult });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          results[task.id] = { taskId: task.id, status: 'failed', error };
          events.push({ type: 'task.failed', taskId: task.id, error });
        }
      }));

      if (batch.some((t) => results[t.id]?.status === 'failed')) break;
    }

    return events;
  }

  private topoSort(tasks: TaskNode[]): { sorted: TaskNode[] | null; levels: Map<string, number> } {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const levels = new Map<string, number>();

    for (const t of tasks) {
      if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
      levels.set(t.id, 0);
      for (const dep of t.dependsOn) {
        if (!adjacency.has(dep)) adjacency.set(dep, []);
        adjacency.get(dep)!.push(t.id);
        inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
      }
    }

    const queue: Array<{ id: string; level: number }> = [];
    for (const t of tasks) {
      if ((inDegree.get(t.id) ?? 0) === 0) queue.push({ id: t.id, level: 0 });
    }

    const sorted: TaskNode[] = [];
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      const node = taskMap.get(id);
      if (!node) continue;
      levels.set(id, level);
      sorted.push(node);
      for (const nid of adjacency.get(id) ?? []) {
        const d = (inDegree.get(nid) ?? 1) - 1;
        inDegree.set(nid, d);
        if (d === 0) queue.push({ id: nid, level: level + 1 });
      }
    }

    return sorted.length === tasks.length ? { sorted, levels } : { sorted: null, levels };
  }

  private groupByLevel(sorted: TaskNode[], levels: Map<string, number>): TaskNode[][] {
    const maxLevel = Math.max(0, ...Array.from(levels.values()));
    const waves: TaskNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
    for (const task of sorted) waves[levels.get(task.id) ?? 0]!.push(task);
    return waves.filter((w) => w.length > 0);
  }
}
