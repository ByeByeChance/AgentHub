import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, like, or } from 'drizzle-orm';
import { agents, conversations, messages, artifacts } from './schema.js';
import type { Database, AgentRecord, ConversationRecord, MessageRecord, ArtifactRecord } from './repository.js';
import * as schema from './schema.js';

export class DrizzleDB implements Database {
  agents: DrizzleAgentRepo;
  conversations: DrizzleConversationRepo;
  messages: DrizzleMessageRepo;
  artifacts: DrizzleArtifactRepo;

  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: Number(process.env.DB_POOL_MIN) || 2,
    });
    const db = drizzle(this.pool, { schema });
    this.agents = new DrizzleAgentRepo(db);
    this.conversations = new DrizzleConversationRepo(db);
    this.messages = new DrizzleMessageRepo(db);
    this.artifacts = new DrizzleArtifactRepo(db);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class DrizzleAgentRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: AgentRecord): Promise<void> {
    await this.db.insert(agents).values({
      id: record.id,
      name: record.name,
      emoji: record.emoji,
      description: record.description,
      category: record.category,
      systemPrompt: record.systemPrompt,
      adapterName: record.adapterName,
      modelId: record.modelId,
      toolNames: record.toolNames,
      isBuiltin: record.isBuiltin,
      isOrchestrator: record.isOrchestrator,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  async findById(id: string): Promise<AgentRecord | null> {
    const result = await this.db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (result.length === 0) return null;
    return mapAgent(result[0]!);
  }

  async listAll(): Promise<AgentRecord[]> {
    const result = await this.db.select({
      id: agents.id, name: agents.name, emoji: agents.emoji,
      description: agents.description, category: agents.category,
      isBuiltin: agents.isBuiltin, isOrchestrator: agents.isOrchestrator,
      createdAt: agents.createdAt, updatedAt: agents.updatedAt,
      systemPrompt: agents.systemPrompt, adapterName: agents.adapterName,
      modelId: agents.modelId, toolNames: agents.toolNames,
    }).from(agents);
    return result.map(mapAgent);
  }

  async listByCategory(category: string): Promise<AgentRecord[]> {
    const result = await this.db.select().from(agents).where(eq(agents.category, category));
    return result.map(mapAgent);
  }

  async search(query: string): Promise<AgentRecord[]> {
    const pattern = `%${query}%`;
    const result = await this.db.select().from(agents).where(
      or(like(agents.name, pattern), like(agents.description, pattern))
    );
    return result.map(mapAgent);
  }

  async count(): Promise<number> {
    const result = await this.db.$count(agents);
    return result;
  }
}

function mapAgent(r: typeof agents.$inferSelect): AgentRecord {
  return {
    id: r.id, name: r.name, emoji: r.emoji, description: r.description,
    category: r.category, systemPrompt: r.systemPrompt,
    adapterName: r.adapterName, modelId: r.modelId,
    toolNames: r.toolNames as string[], isBuiltin: r.isBuiltin,
    isOrchestrator: r.isOrchestrator,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

class DrizzleConversationRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: ConversationRecord): Promise<void> {
    await this.db.insert(conversations).values({
      id: record.id, title: record.title, mode: record.mode,
      agentIds: record.agentIds,
      pinnedAt: record.pinnedAt ? new Date(record.pinnedAt) : null,
      createdAt: new Date(record.createdAt),
    });
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const result = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (result.length === 0) return null;
    const r = result[0]!;
    return {
      id: r.id, title: r.title, mode: r.mode as 'single' | 'group',
      agentIds: r.agentIds as string[],
      pinnedAt: r.pinnedAt?.toISOString() ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  async listAll(): Promise<ConversationRecord[]> {
    const result = await this.db.select().from(conversations);
    return result.map(r => ({
      id: r.id, title: r.title, mode: r.mode as 'single' | 'group',
      agentIds: r.agentIds as string[],
      pinnedAt: r.pinnedAt?.toISOString() ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }
}

class DrizzleMessageRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: MessageRecord): Promise<void> {
    await this.db.insert(messages).values({
      id: record.id, conversationId: record.conversationId,
      role: record.role, parts: record.parts, status: record.status,
      createdAt: new Date(record.createdAt),
    });
  }

  async findById(id: string): Promise<MessageRecord | null> {
    const result = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    if (result.length === 0) return null;
    const r = result[0]!;
    return {
      id: r.id, conversationId: r.conversationId,
      role: r.role as MessageRecord['role'],
      parts: r.parts as MessageRecord['parts'],
      status: r.status as MessageRecord['status'],
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  async listByConversation(conversationId: string): Promise<MessageRecord[]> {
    const result = await this.db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    return result.map(r => ({
      id: r.id, conversationId: r.conversationId,
      role: r.role as MessageRecord['role'],
      parts: r.parts as MessageRecord['parts'],
      status: r.status as MessageRecord['status'],
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }

  async update(id: string, updates: Partial<Pick<MessageRecord, 'parts' | 'status'>>): Promise<MessageRecord | null> {
    const setData: Record<string, unknown> = {};
    if (updates.parts !== undefined) setData['parts'] = updates.parts;
    if (updates.status !== undefined) setData['status'] = updates.status;

    await this.db.update(messages).set(setData).where(eq(messages.id, id));
    return this.findById(id);
  }
}

class DrizzleArtifactRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: ArtifactRecord): Promise<void> {
    await this.db.insert(artifacts).values({
      id: record.id, conversationId: record.conversationId,
      type: record.type, title: record.title,
      content: record.content as Record<string, unknown>,
      version: record.version,
      parentArtifactId: record.parentArtifactId,
      createdAt: new Date(record.createdAt),
    });
  }

  async findById(id: string): Promise<ArtifactRecord | null> {
    const result = await this.db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
    if (result.length === 0) return null;
    const r = result[0]!;
    return {
      id: r.id, conversationId: r.conversationId,
      type: r.type as ArtifactRecord['type'], title: r.title,
      content: r.content, version: r.version,
      parentArtifactId: r.parentArtifactId,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  async listByConversation(conversationId: string): Promise<ArtifactRecord[]> {
    const result = await this.db.select().from(artifacts)
      .where(eq(artifacts.conversationId, conversationId));
    return result.map(r => ({
      id: r.id, conversationId: r.conversationId,
      type: r.type as ArtifactRecord['type'], title: r.title,
      content: r.content, version: r.version,
      parentArtifactId: r.parentArtifactId,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }
}
