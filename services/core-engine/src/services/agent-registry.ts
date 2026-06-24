import type { Database, AgentRecord } from '@agenthub/shared/db';

export interface AgentMetadata {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  isBuiltin: boolean;
  isOrchestrator: boolean;
  createdAt: string;
}

export interface AgentFull extends AgentMetadata {
  systemPrompt: string;
  adapterName: string;
  modelId: string;
  toolNames: string[];
}

export interface CreateAgentInput {
  name: string;
  emoji: string;
  description: string;
  category: string;
  systemPrompt: string;
  adapterName?: string;
  modelId?: string;
  toolNames?: string[];
}

export class AgentRegistry {
  constructor(private readonly db: Database) {}

  async listByCategory(category: string): Promise<AgentMetadata[]> {
    const agents = await this.db.agents.listByCategory(category);
    return agents.map(toAgentMetadata);
  }

  async listAll(): Promise<AgentMetadata[]> {
    const agents = await this.db.agents.listAll();
    return agents.map(toAgentMetadata);
  }

  async getById(id: string): Promise<AgentFull | null> {
    const raw = await this.db.agents.findById(id);
    if (!raw) return null;
    return toAgentFull(raw);
  }

  async create(input: CreateAgentInput): Promise<AgentFull> {
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
  }

  async search(query: string): Promise<AgentMetadata[]> {
    const agents = await this.db.agents.search(query);
    return agents.map(toAgentMetadata);
  }

  async count(): Promise<number> {
    return this.db.agents.count();
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
