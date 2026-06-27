import { describe, it, expect, afterEach } from 'vitest';
import { createHealthServer } from '@agenthub/shared/server';
import { InMemoryDB } from '@agenthub/shared/db';
import { registerAgentRoutes } from '../../routes/agents.js';
import { AgentRegistry } from '../../services/agent-registry.js';

describe('DB Failure Resilience', () => {
  afterEach(() => {});

  it('should return 500 with RFC 9457 body when DB insert fails', async () => {
    const db = new InMemoryDB();
    const registry = new AgentRegistry(db);
    const app = createHealthServer({ serviceName: 'test-db-fail' });
    registerAgentRoutes(app, registry);
    await app.ready();

    // Simulate DB failure by breaking the insert method
    const originalInsert = db.agents.insert.bind(db.agents);
    (db.agents as unknown as Record<string, unknown>).insert = async () => {
      throw new Error('Database connection lost');
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { name: 'Test', emoji: '🤖', description: 'desc', category: 'eng', systemPrompt: 'sp' },
    });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.type).toBeDefined();

    // Restore
    (db.agents as unknown as Record<string, unknown>).insert = originalInsert;
    await app.close();
  });
});
