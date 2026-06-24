import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToolExecutor, type ToolContext } from './tool-executor.js';
import { InMemoryDB } from '@agenthub/shared/db';
import type { Database } from '@agenthub/shared/db';
import { createWorkspaceService } from './workspace.service.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let db: Database;
  let context: ToolContext;
  let tempDir: string;

  beforeEach(async () => {
    executor = new ToolExecutor();
    db = new InMemoryDB();
    tempDir = await mkdtemp(join(tmpdir(), 'agenthub-tool-test-'));
    const ws = createWorkspaceService(tempDir);
    context = { conversationId: 'conv-1', workspaceService: ws, db, agentId: 'agent-1', signal: new AbortController().signal };
  });

  afterEach(async () => { await rm(tempDir, { recursive: true, force: true }); });

  it('should have 5 built-in tools', () => {
    const defs = executor.getDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(5);
  });

  it('should execute fs_write and fs_read', async () => {
    const wr = await executor.execute('fs_write', { path: 'hello.txt', content: 'world' }, context);
    expect(wr.isError).toBe(false);
    const rr = await executor.execute('fs_read', { path: 'hello.txt' }, context);
    expect(rr.result).toBe('world');
  });

  it('should execute write_artifact', async () => {
    await executor.execute('write_artifact', { type: 'code', title: 'test.ts', content: { code: 'x=1' } }, context);
    const arts = await db.artifacts.listByConversation('conv-1');
    expect(arts).toHaveLength(1);
  });

  it('should return error for unknown tool', async () => {
    const r = await executor.execute('nope', {}, context);
    expect(r.isError).toBe(true);
  });

  it('should block dangerous bash commands', async () => {
    const r = await executor.execute('bash', { command: 'rm -rf /' }, context);
    const parsed = JSON.parse(r.result as string);
    expect(parsed.exitCode).toBe(1);
  });
});
