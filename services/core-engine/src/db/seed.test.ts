import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../services/agent-registry.js';
import { InMemoryDB } from '@agenthub/shared/db';
import type { Database } from '@agenthub/shared/db';
import { parseAgentContent, seedAgents, getToolsByCategory } from './seed.js';

describe('Seed Script', () => {
  let registry: AgentRegistry;
  let db: Database;

  beforeEach(() => {
    db = new InMemoryDB();
    registry = new AgentRegistry(db);
  });

  describe('parseAgentContent', () => {
    it('should parse YAML frontmatter', async () => {
      const content = `---
name: Test Agent
description: A test agent
emoji: "🧪"
---
# Personality
You are **TestAgent**.`;

      const result = await parseAgentContent(content, 'data/agency-agents/testing/test-agent.md');
      expect(result.name).toBe('Test Agent');
      expect(result.emoji).toBe('🧪');
      expect(result.category).toBe('testing');
      expect(result.systemPrompt).toContain('**TestAgent**');
    });
  });

  describe('seedAgents', () => {
    it('should import agents', async () => {
      const files = [{
        path: 'data/agency-agents/engineering/frontend.md',
        content: '---\nname: Frontend Developer\ndescription: Expert\nemoji: "💻"\n---\nPrompt.',
      }];
      const count = await seedAgents(registry, files);
      expect(count).toBe(1);
      expect(await registry.count()).toBe(1);
    });

    it('should be idempotent', async () => {
      const files = [{
        path: 'data/agency-agents/engineering/frontend.md',
        content: '---\nname: FD\ndescription: E\n---\nP.',
      }];
      expect(await seedAgents(registry, files)).toBe(1);
      expect(await seedAgents(registry, files)).toBe(0);
    });
  });

  describe('getToolsByCategory', () => {
    it('should return tools for known category', () => {
      expect(getToolsByCategory('engineering')).toContain('bash');
    });
    it('should return default for unknown', () => {
      expect(getToolsByCategory('unknown')).toEqual(['write_artifact']);
    });
  });
});
