import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, like, or } from 'drizzle-orm';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { agents, conversations, messages, artifacts, documents } from './schema.js';
import type { Database, AgentRecord, ConversationRecord, MessageRecord, ArtifactRecord, DocumentRecord, SearchResult } from './repository.interface.js';
import * as schema from './schema.js';

function wrapDbError(operation: string, err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  return new Error(`Database operation '${operation}' failed: ${message}`, { cause: err });
}

export class DrizzleDB implements Database {
  agents: DrizzleAgentRepo;
  conversations: DrizzleConversationRepo;
  messages: DrizzleMessageRepo;
  artifacts: DrizzleArtifactRepo;
  documents: DrizzleDocumentRepo;

  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX) || SERVICE_DEFAULTS.dbPool.max,
      min: Number(process.env.DB_POOL_MIN) || SERVICE_DEFAULTS.dbPool.min,
    });
    const db = drizzle(this.pool, { schema });
    this.agents = new DrizzleAgentRepo(db);
    this.conversations = new DrizzleConversationRepo(db);
    this.messages = new DrizzleMessageRepo(db);
    this.artifacts = new DrizzleArtifactRepo(db);
    this.documents = new DrizzleDocumentRepo(db, this.pool);
  }

  /** Create tables and indexes if they don't exist (idempotent). */
  async ensureTables(): Promise<void> {
    const sql = await this.pool.connect();
    try {
      await sql.query('CREATE EXTENSION IF NOT EXISTS vector');
      await sql.query(`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          emoji TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          system_prompt TEXT NOT NULL,
          adapter_name TEXT NOT NULL DEFAULT 'deepseek',
          model_id TEXT NOT NULL DEFAULT 'deepseek-v4-pro',
          tool_names JSONB NOT NULL DEFAULT '[]',
          is_builtin BOOLEAN NOT NULL DEFAULT false,
          is_orchestrator BOOLEAN NOT NULL DEFAULT false,
          name_i18n JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      // Migration: add name_i18n column if table already exists without it
      await sql.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS name_i18n JSONB');
      await sql.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'New Conversation',
          mode TEXT NOT NULL DEFAULT 'single',
          agent_ids JSONB NOT NULL DEFAULT '[]',
          pinned_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id),
          role TEXT NOT NULL,
          parts JSONB NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'streaming',
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id),
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          content JSONB NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          parent_artifact_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding vector(1536),
          metadata JSONB NOT NULL DEFAULT '{}',
          source TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      // Index for message lookups by conversation
      await sql.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)');
      // Index for artifact lookups by conversation
      await sql.query('CREATE INDEX IF NOT EXISTS idx_artifacts_conversation_id ON artifacts(conversation_id)');
    } finally {
      sql.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class DrizzleAgentRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: AgentRecord): Promise<void> {
    try {
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
        nameI18n: record.nameI18n ?? null,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      });
    } catch (err) {
      throw wrapDbError('agents.insert', err);
    }
  }

  async findById(id: string): Promise<AgentRecord | null> {
    try {
      const result = await this.db.select().from(agents).where(eq(agents.id, id)).limit(1);
      if (result.length === 0) return null;
      return mapAgent(result[0]!);
    } catch (err) {
      throw wrapDbError('agents.findById', err);
    }
  }

  async listAll(): Promise<AgentRecord[]> {
    try {
      const result = await this.db.select({
        id: agents.id, name: agents.name, emoji: agents.emoji,
        description: agents.description, category: agents.category,
        isBuiltin: agents.isBuiltin, isOrchestrator: agents.isOrchestrator,
        nameI18n: agents.nameI18n,
        createdAt: agents.createdAt, updatedAt: agents.updatedAt,
        systemPrompt: agents.systemPrompt, adapterName: agents.adapterName,
        modelId: agents.modelId, toolNames: agents.toolNames,
      }).from(agents);
      return result.map(mapAgent);
    } catch (err) {
      throw wrapDbError('agents.listAll', err);
    }
  }

  async listByCategory(category: string): Promise<AgentRecord[]> {
    try {
      const result = await this.db.select().from(agents).where(eq(agents.category, category));
      return result.map(mapAgent);
    } catch (err) {
      throw wrapDbError('agents.listByCategory', err);
    }
  }

  async search(query: string): Promise<AgentRecord[]> {
    try {
      const pattern = `%${query}%`;
      const result = await this.db.select().from(agents).where(
        or(like(agents.name, pattern), like(agents.description, pattern))
      );
      return result.map(mapAgent);
    } catch (err) {
      throw wrapDbError('agents.search', err);
    }
  }

  async count(): Promise<number> {
    try {
      const result = await this.db.$count(agents);
      return result;
    } catch (err) {
      throw wrapDbError('agents.count', err);
    }
  }
}

function mapAgent(r: typeof agents.$inferSelect): AgentRecord {
  return {
    id: r.id, name: r.name, emoji: r.emoji, description: r.description,
    category: r.category, systemPrompt: r.systemPrompt,
    adapterName: r.adapterName, modelId: r.modelId,
    toolNames: r.toolNames as string[], isBuiltin: r.isBuiltin,
    isOrchestrator: r.isOrchestrator,
    nameI18n: r.nameI18n as AgentRecord['nameI18n'] | undefined,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

class DrizzleConversationRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: ConversationRecord): Promise<void> {
    try {
      await this.db.insert(conversations).values({
        id: record.id, title: record.title, mode: record.mode,
        agentIds: record.agentIds,
        pinnedAt: record.pinnedAt ? new Date(record.pinnedAt) : null,
        createdAt: new Date(record.createdAt),
      });
    } catch (err) {
      throw wrapDbError('conversations.insert', err);
    }
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    try {
      const result = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (result.length === 0) return null;
      const r = result[0]!;
      return {
        id: r.id, title: r.title, mode: r.mode as 'single' | 'group',
        agentIds: r.agentIds as string[],
        pinnedAt: r.pinnedAt?.toISOString() ?? null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      };
    } catch (err) {
      throw wrapDbError('conversations.findById', err);
    }
  }

  async listAll(): Promise<ConversationRecord[]> {
    try {
      const result = await this.db.select().from(conversations);
      return result.map(r => ({
        id: r.id, title: r.title, mode: r.mode as 'single' | 'group',
        agentIds: r.agentIds as string[],
        pinnedAt: r.pinnedAt?.toISOString() ?? null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      }));
    } catch (err) {
      throw wrapDbError('conversations.listAll', err);
    }
  }
}

class DrizzleMessageRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: MessageRecord): Promise<void> {
    try {
      await this.db.insert(messages).values({
        id: record.id, conversationId: record.conversationId,
        role: record.role, parts: record.parts, status: record.status,
        createdAt: new Date(record.createdAt),
      });
    } catch (err) {
      throw wrapDbError('messages.insert', err);
    }
  }

  async findById(id: string): Promise<MessageRecord | null> {
    try {
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
    } catch (err) {
      throw wrapDbError('messages.findById', err);
    }
  }

  async listByConversation(conversationId: string): Promise<MessageRecord[]> {
    try {
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
    } catch (err) {
      throw wrapDbError('messages.listByConversation', err);
    }
  }

  async update(id: string, updates: Partial<Pick<MessageRecord, 'parts' | 'status'>>): Promise<MessageRecord | null> {
    try {
      const setData: Record<string, unknown> = {};
      if (updates.parts !== undefined) setData['parts'] = updates.parts;
      if (updates.status !== undefined) setData['status'] = updates.status;

      await this.db.update(messages).set(setData).where(eq(messages.id, id));
      return this.findById(id);
    } catch (err) {
      throw wrapDbError('messages.update', err);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.delete(messages).where(eq(messages.id, id));
    } catch (err) {
      throw wrapDbError('messages.delete', err);
    }
  }
}

class DrizzleArtifactRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: ArtifactRecord): Promise<void> {
    try {
      await this.db.insert(artifacts).values({
        id: record.id, conversationId: record.conversationId,
        type: record.type, title: record.title,
        content: record.content as Record<string, unknown>,
        version: record.version,
        parentArtifactId: record.parentArtifactId,
        createdAt: new Date(record.createdAt),
      });
    } catch (err) {
      throw wrapDbError('artifacts.insert', err);
    }
  }

  async findById(id: string): Promise<ArtifactRecord | null> {
    try {
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
    } catch (err) {
      throw wrapDbError('artifacts.findById', err);
    }
  }

  async listByConversation(conversationId: string): Promise<ArtifactRecord[]> {
    try {
      const result = await this.db.select().from(artifacts)
        .where(eq(artifacts.conversationId, conversationId));
      return result.map(r => ({
        id: r.id, conversationId: r.conversationId,
        type: r.type as ArtifactRecord['type'], title: r.title,
        content: r.content, version: r.version,
        parentArtifactId: r.parentArtifactId,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      }));
    } catch (err) {
      throw wrapDbError('artifacts.listByConversation', err);
    }
  }
}

class DrizzleDocumentRepo {
  constructor(
    private db: ReturnType<typeof drizzle>,
    private pool: Pool,
  ) {}

  async insert(record: DocumentRecord): Promise<void> {
    try {
      await this.db.insert(documents).values({
        id: record.id,
        content: record.content,
        embedding: record.embedding ?? undefined,
        metadata: record.metadata as Record<string, unknown>,
        source: record.source,
        createdAt: new Date(record.createdAt),
      });
    } catch (err) {
      throw wrapDbError('documents.insert', err);
    }
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    try {
      const result = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
      if (result.length === 0) return null;
      return mapDocument(result[0]!);
    } catch (err) {
      throw wrapDbError('documents.findById', err);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.delete(documents).where(eq(documents.id, id));
    } catch (err) {
      throw wrapDbError('documents.delete', err);
    }
  }

  async searchByVector(embedding: number[], options?: {
    topK?: number;
    threshold?: number;
    filters?: Record<string, unknown>;
  }): Promise<SearchResult[]> {
    try {
      const topK = options?.topK ?? 10;
      const threshold = options?.threshold ?? 0.0;
      const vectorStr = `[${embedding.join(',')}]`;

      // Use raw SQL for pgvector cosine similarity search
      // cosine similarity = 1 - (embedding <=> query_vector)
      const queryText = `
        SELECT
          id, content, embedding::text AS embedding, metadata, source, created_at,
          1 - (embedding <=> $1::vector) AS score
        FROM documents
        WHERE 1 - (embedding <=> $1::vector) >= $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;

      const result = await this.pool.query(queryText, [vectorStr, threshold, topK]);
      return result.rows.map((row: Record<string, unknown>) => ({
        id: row['id'] as string,
        content: row['content'] as string,
        embedding: typeof row['embedding'] === 'string'
          ? (row['embedding'] as string).replace(/[[\]\s]/g, '').split(',').filter(Boolean).map(Number)
          : (Array.isArray(row['embedding']) ? row['embedding'] as number[] : null),
        metadata: (row['metadata'] as Record<string, unknown>) ?? {},
        source: (row['source'] as string) ?? null,
        createdAt: row['created_at'] instanceof Date
          ? (row['created_at'] as Date).toISOString()
          : String(row['created_at']),
        score: Number(row['score']),
      }));
    } catch (err) {
      throw wrapDbError('documents.searchByVector', err);
    }
  }
}

function mapDocument(r: Record<string, unknown>): DocumentRecord {
  return {
    id: r['id'] as string,
    content: r['content'] as string,
    embedding: typeof r['embedding'] === 'string'
      ? (r['embedding'] as string).replace(/[[\]\s]/g, '').split(',').filter(Boolean).map(Number)
      : (Array.isArray(r['embedding']) ? r['embedding'] as number[] : null),
    metadata: (r['metadata'] as Record<string, unknown>) ?? {},
    source: (r['source'] as string) ?? null,
    createdAt: r['created_at'] instanceof Date
      ? (r['created_at'] as Date).toISOString()
      : String(r['created_at']),
  };
}
