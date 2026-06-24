import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../../services/agent-registry.js';
import type { CreateAgentInput } from '../../services/interfaces/agent.interface.js';
import { InMemoryDB } from '@agenthub/shared/db';
import type { Database } from '@agenthub/shared/db';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let db: Database;

  const sampleAgent: CreateAgentInput = {
    name: 'Frontend Developer', emoji: '💻',
    description: 'Expert in React and TypeScript',
    category: 'engineering', systemPrompt: 'You are a frontend developer.',
    toolNames: ['fs_read', 'fs_write', 'bash'],
  };

  beforeEach(() => {
    db = new InMemoryDB();
    registry = new AgentRegistry(db);
  });

  it('should create and retrieve an agent', async () => {
    const agent = await registry.create(sampleAgent);
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('Frontend Developer');
    const retrieved = await registry.getById(agent.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.systemPrompt).toBe('You are a frontend developer.');
  });

  it('should list agents by category', async () => {
    await registry.create(sampleAgent);
    await registry.create({ ...sampleAgent, name: 'SEO Specialist', category: 'marketing' });
    const engineers = await registry.listByCategory('engineering');
    expect(engineers).toHaveLength(1);
    expect(await registry.listAll()).toHaveLength(2);
  });

  it('should search agents', async () => {
    await registry.create(sampleAgent);
    await registry.create({ ...sampleAgent, name: 'Backend Developer', description: 'Node.js' });
    const results = await registry.search('react');
    expect(results).toHaveLength(1);
  });

  it('should return count', async () => {
    expect(await registry.count()).toBe(0);
    await registry.create(sampleAgent);
    expect(await registry.count()).toBe(1);
  });

  it('should return null for non-existent agent', async () => {
    expect(await registry.getById('nope')).toBeNull();
  });
});
