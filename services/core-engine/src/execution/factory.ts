import type { ExecutionStrategy } from '@agenthub/shared/execution';
import { DAGExecutor } from './dag-executor.js';
import { SequentialExecutor } from './sequential-executor.js';
import { ParallelExecutor } from './parallel-executor.js';

export function createExecutionStrategy(): ExecutionStrategy {
  const strategy = process.env.EXECUTION_STRATEGY ?? 'dag';
  if (strategy === 'sequential') return new SequentialExecutor();
  if (strategy === 'parallel') return new ParallelExecutor();
  return new DAGExecutor();
}
