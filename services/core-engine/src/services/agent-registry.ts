import type { Database, AgentRecord } from '@agenthub/shared/db';
import type { AgentMetadata, AgentFull, CreateAgentInput } from './interfaces/agent.interface.js';

export class AgentRegistry {
  constructor(private readonly db: Database) {}

  async listByCategory(category: string): Promise<AgentMetadata[]> {
    try {
      const agents = await this.db.agents.listByCategory(category);
      return agents.map(toAgentMetadata);
    } catch (err) {
      throw new Error(`Failed to list agents by category '${category}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async listAll(): Promise<AgentMetadata[]> {
    try {
      const agents = await this.db.agents.listAll();
      return agents.map(toAgentMetadata);
    } catch (err) {
      throw new Error(`Failed to list all agents: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async getById(id: string): Promise<AgentFull | null> {
    try {
      const raw = await this.db.agents.findById(id);
      if (!raw) return null;
      return toAgentFull(raw);
    } catch (err) {
      throw new Error(`Failed to get agent '${id}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async create(input: CreateAgentInput): Promise<AgentFull> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const record: AgentRecord = {
        id,
        name: input.name,
        emoji: input.emoji,
        description: input.description,
        category: input.category,
        systemPrompt: input.systemPrompt,
        adapterName: input.adapterName ?? 'deepseek',
        modelId: input.modelId ?? 'deepseek-v4-pro',
        toolNames: input.toolNames ?? [],
        isBuiltin: false,
        isOrchestrator: false,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.agents.insert(record);
      return toAgentFull(record);
    } catch (err) {
      throw new Error(`Failed to create agent '${input.name}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async search(query: string): Promise<AgentMetadata[]> {
    try {
      const agents = await this.db.agents.search(query);
      return agents.map(toAgentMetadata);
    } catch (err) {
      throw new Error(`Failed to search agents with query '${query}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async count(): Promise<number> {
    try {
      return this.db.agents.count();
    } catch (err) {
      throw new Error(`Failed to count agents: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
}

function toAgentMetadata(raw: AgentRecord): AgentMetadata {
  return {
    id: raw.id,
    name: raw.name,
    emoji: raw.emoji,
    description: raw.description,
    category: raw.category,
    isBuiltin: raw.isBuiltin,
    isOrchestrator: raw.isOrchestrator,
    createdAt: raw.createdAt,
  };
}

function toAgentFull(raw: AgentRecord): AgentFull {
  return {
    ...toAgentMetadata(raw),
    systemPrompt: raw.systemPrompt,
    adapterName: raw.adapterName,
    modelId: raw.modelId,
    toolNames: raw.toolNames,
  };
}
