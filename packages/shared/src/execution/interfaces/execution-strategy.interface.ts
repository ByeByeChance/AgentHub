/** A single task node in the execution DAG. */
export interface TaskNode {
  id: string;
  agentId: string;
  skillId?: string;
  /** Task input — either a static string or a function that resolves dependencies. */
  input: string | ((results: Record<string, TaskResult>) => string);
  /** IDs of tasks that must complete before this one can start. */
  dependsOn: string[];
  config?: TaskConfig;
}

export interface TaskConfig {
  maxRetries?: number;
  timeout?: number;
  modelId?: string;
}

/** Result of executing one task. */
export interface TaskResult {
  taskId: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'aborted';
  output?: string;
  error?: string;
  toolCalls?: number;
  tokensUsed?: { in: number; out: number };
  startedAt?: string;
  completedAt?: string;
}

/** A complete execution plan — DAG of tasks. */
export interface ExecutionPlan {
  tasks: TaskNode[];
  strategy: 'dag' | 'sequential' | 'parallel';
  globalTimeout?: number;
  maxConcurrent?: number;
}

/** Events yielded during plan execution. */
export type ExecutionEvent =
  | { type: 'task.start'; taskId: string; agentId: string }
  | { type: 'task.complete'; taskId: string; result: TaskResult }
  | { type: 'task.failed'; taskId: string; error: string }
  | { type: 'plan.complete'; results: Record<string, TaskResult> }
  | { type: 'plan.failed'; error: string };

/**
 * Pluggable execution strategy for scheduling and running a task plan.
 *
 * - `DAGExecutor`: topological sort → wave grouping → parallel within waves.
 * - `SequentialExecutor`: one task at a time in dependency order.
 * - `ParallelExecutor`: all tasks concurrently, ignoring dependencies.
 */
export interface ExecutionStrategy {
  readonly name: string;
  execute(plan: ExecutionPlan, context: ExecutionContext): AsyncGenerator<ExecutionEvent>;
}

/** Context provided to the execution strategy — abstracts the agent runtime. */
export interface ExecutionContext {
  runTask: (task: TaskNode, signal: AbortSignal) => AsyncGenerator<TaskResult>;
  signal: AbortSignal;
}
