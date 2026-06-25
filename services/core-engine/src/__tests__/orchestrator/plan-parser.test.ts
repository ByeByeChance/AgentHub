import { describe, it, expect } from 'vitest';
import { parsePlan } from '../../orchestrator/plan-parser.js';

describe('executionPlanSchema', () => {
  it('should accept a valid DAG plan', () => {
    const plan = {
      tasks: [
        { id: 'task-1', agentId: 'agent-a', input: 'Do step 1', dependsOn: [] },
        { id: 'task-2', agentId: 'agent-b', input: 'Do step 2', dependsOn: ['task-1'] },
      ],
      strategy: 'dag',
    };
    expect(() => parsePlan(plan)).not.toThrow();
    const parsed = parsePlan(plan);
    expect(parsed.strategy).toBe('dag');
    expect(parsed.tasks).toHaveLength(2);
  });

  it('should accept a sequential plan', () => {
    const plan = {
      tasks: [
        { id: 'step-1', agentId: 'agent-1', input: 'First', dependsOn: [] },
        { id: 'step-2', agentId: 'agent-1', input: 'Second', dependsOn: ['step-1'] },
        { id: 'step-3', agentId: 'agent-1', input: 'Third', dependsOn: ['step-2'] },
      ],
      strategy: 'sequential',
      globalTimeout: 60000,
    };
    expect(() => parsePlan(plan)).not.toThrow();
  });

  it('should accept a parallel plan', () => {
    const plan = {
      tasks: [
        { id: 't1', agentId: 'a', input: 'A', dependsOn: [] },
        { id: 't2', agentId: 'b', input: 'B', dependsOn: [] },
        { id: 't3', agentId: 'c', input: 'C', dependsOn: [] },
      ],
      strategy: 'parallel',
      maxConcurrent: 2,
    };
    expect(() => parsePlan(plan)).not.toThrow();
  });

  it('should default strategy to dag', () => {
    const plan = {
      tasks: [{ id: 't1', agentId: 'a', input: 'test', dependsOn: [] }],
    };
    const parsed = parsePlan(plan);
    expect(parsed.strategy).toBe('dag');
  });

  it('should default dependsOn to empty array', () => {
    const plan = {
      tasks: [{ id: 't1', agentId: 'a', input: 'test' }],
    };
    const parsed = parsePlan(plan);
    expect(parsed.tasks[0]!.dependsOn).toEqual([]);
  });

  it('should reject plan with no tasks', () => {
    expect(() => parsePlan({ tasks: [] })).toThrow();
  });

  it('should reject plan with missing task id', () => {
    expect(() =>
      parsePlan({
        tasks: [{ agentId: 'a', input: 'test', dependsOn: [] }],
      }),
    ).toThrow();
  });

  it('should reject plan with empty task id', () => {
    expect(() =>
      parsePlan({
        tasks: [{ id: '', agentId: 'a', input: 'test', dependsOn: [] }],
      }),
    ).toThrow();
  });

  it('should reject plan with empty input', () => {
    expect(() =>
      parsePlan({
        tasks: [{ id: 't1', agentId: 'a', input: '', dependsOn: [] }],
      }),
    ).toThrow();
  });

  it('should reject plan with invalid strategy', () => {
    expect(() =>
      parsePlan({
        tasks: [{ id: 't1', agentId: 'a', input: 'test', dependsOn: [] }],
        strategy: 'invalid',
      }),
    ).toThrow();
  });

  it('should accept optional config fields', () => {
    const plan = {
      tasks: [
        {
          id: 't1',
          agentId: 'a',
          input: 'test',
          dependsOn: [],
          config: { maxRetries: 2, timeout: 30000, modelId: 'deepseek-v4' },
        },
      ],
    };
    const parsed = parsePlan(plan);
    expect(parsed.tasks[0]!.config?.maxRetries).toBe(2);
    expect(parsed.tasks[0]!.config?.timeout).toBe(30000);
    expect(parsed.tasks[0]!.config?.modelId).toBe('deepseek-v4');
  });

  it('should accept optional skillId', () => {
    const plan = {
      tasks: [
        { id: 't1', agentId: 'a', input: 'test', dependsOn: [], skillId: 'skill-1' },
      ],
    };
    const parsed = parsePlan(plan);
    expect(parsed.tasks[0]!.skillId).toBe('skill-1');
  });
});
