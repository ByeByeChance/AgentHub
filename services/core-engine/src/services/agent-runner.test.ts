import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRunner } from './agent-runner.js';
import { MockDeepSeekAdapter } from '../adapters/mock-deepseek-adapter.js';
import { ToolExecutor } from './tool-executor.js';
import { ConversationService } from './conversation.service.js';
import { createWorkspaceService } from './workspace.service.js';
import { InMemoryDB } from '@agenthub/shared/db';
import type { Database } from '@agenthub/shared/db';
import { getEventBus } from '@agenthub/shared/event-bus';
import { EVENT_TYPES, type EventSource } from '@agenthub/contracts';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AgentConfig } from '@agenthub/shared/adapter';
import type { EventEnvelope } from '@agenthub/contracts';

describe('AgentRunner', () => {
  let runner: AgentRunner;
  let adapter: MockDeepSeekAdapter;
  let toolExecutor: ToolExecutor;
  let conversationService: ConversationService;
  let db: Database;
  let source: EventSource;
  let config: AgentConfig;
  let tempDir: string;

  beforeEach(async () => {
    runner = new AgentRunner();
    adapter = new MockDeepSeekAdapter();
    toolExecutor = new ToolExecutor();
    db = new InMemoryDB();
    conversationService = new ConversationService(db);
    tempDir = await mkdtemp(join(tmpdir(), 'agenthub-runner-'));
    getEventBus().reset();
    source = { service: 'core-engine', instanceId: 'test-1' };
    config = { id: 'agent-1', name: 'Test Agent', systemPrompt: 'You are helpful.', adapterName: 'mock', modelId: 'mock', toolNames: [] };
  });

  afterEach(async () => { await rm(tempDir, { recursive: true, force: true }); });

  async function collectEvents(msgId: string, signal?: AbortSignal & { aborted: boolean }): Promise<EventEnvelope[]> {
    const events: EventEnvelope[] = [];
    const ws = createWorkspaceService(tempDir);
    const sig = signal ?? new AbortController().signal;
    await db.messages.insert({ id: msgId, conversationId: 'conv-1', role: 'assistant', parts: [], status: 'streaming', createdAt: new Date().toISOString() });
    for await (const event of runner.run({ agentConfig: config, conversationId: 'conv-1', messages: [{ role: 'user', content: 'Hello' }], toolExecutor, adapter, eventBus: getEventBus(), source, conversationService, workspaceService: ws, db, signal: sig }, msgId)) {
      events.push(event);
    }
    return events;
  }

  it('should emit start→text→complete', async () => {
    adapter.setTextResponse('Hello!');
    const events = await collectEvents('msg-1');
    const types = events.map(e => e.eventType);
    expect(types[0]).toBe(EVENT_TYPES.AGENT_RUN_START);
    expect(types).toContain(EVENT_TYPES.MESSAGE_PART_TEXT);
    expect(types[types.length - 1]).toBe(EVENT_TYPES.AGENT_RUN_COMPLETE);
  });

  it('should emit tool_use and tool_result for tool calls', async () => {
    adapter.setToolCallSequence([{ name: 'fs_write', input: { path: 't.txt', content: 'w' } }], 'Done.');
    const events = await collectEvents('msg-2');
    const types = events.map(e => e.eventType);
    expect(types).toContain(EVENT_TYPES.MESSAGE_PART_TOOL_USE);
    expect(types).toContain(EVENT_TYPES.MESSAGE_PART_TOOL_RESULT);
  });

  it('should emit agent.run.aborted on abort', async () => {
    const ctrl = new AbortController();
    adapter.setResponses([Array.from({ length: 10 }, (_, i) => ({ type: 'text_delta' as const, content: `c${i}` }))]);
    ctrl.abort();
    const events = await collectEvents('msg-3', ctrl.signal);
    expect(events[events.length - 1]!.eventType).toBe(EVENT_TYPES.AGENT_RUN_ABORTED);
  });

  it('should emit agent.run.failed on error', async () => {
    adapter.setError('API error');
    const events = await collectEvents('msg-4');
    expect(events[events.length - 1]!.eventType).toBe(EVENT_TYPES.AGENT_RUN_FAILED);
  });

  it('should wrap events in EventEnvelope format', async () => {
    adapter.setTextResponse('Hi');
    const events = await collectEvents('msg-5');
    for (const e of events) {
      expect(e.eventId).toBeDefined();
      expect(e.timestamp).toBeDefined();
      expect(e.traceId).toBeDefined();
    }
  });
});
