import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { gte } from 'drizzle-orm';
import { tokenRecords, auditLog } from './schema.js';
import type { ObservabilityDatabase, TokenRecordData, AuditEntryData } from './repository.js';
import * as schema from './schema.js';

// ---- Drizzle Implementation ----
export class DrizzleObservabilityDB implements ObservabilityDatabase {
  tokenRecords: DrizzleTokenRepo;
  auditLog: DrizzleAuditRepo;

  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: Number(process.env.DB_POOL_MIN) || 2,
    });
    const db = drizzle(this.pool, { schema });
    this.tokenRecords = new DrizzleTokenRepo(db);
    this.auditLog = new DrizzleAuditRepo(db);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class DrizzleTokenRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: TokenRecordData): Promise<void> {
    await this.db.insert(tokenRecords).values({
      id: record.id,
      model: record.model,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      cost: String(record.cost),
      conversationId: record.conversationId,
      agentId: record.agentId,
      createdAt: new Date(record.createdAt),
    });
  }

  async findByPeriod(since: string): Promise<TokenRecordData[]> {
    const result = await this.db
      .select()
      .from(tokenRecords)
      .where(gte(tokenRecords.createdAt, new Date(since)));
    return result.map(mapToken);
  }
}

function mapToken(r: Record<string, unknown>): TokenRecordData {
  return {
    id: r['id'] as string,
    model: r['model'] as string,
    tokensIn: Number(r['tokens_in']),
    tokensOut: Number(r['tokens_out']),
    cost: Number(r['cost']),
    conversationId: (r['conversation_id'] as string) ?? null,
    agentId: (r['agent_id'] as string) ?? null,
    createdAt: r['created_at'] instanceof Date
      ? (r['created_at'] as Date).toISOString()
      : String(r['created_at']),
  };
}

class DrizzleAuditRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(entry: AuditEntryData): Promise<void> {
    await this.db.insert(auditLog).values({
      id: entry.id,
      entryType: entry.entryType,
      payload: entry.payload as Record<string, unknown>,
      previousHash: entry.previousHash,
      currentHash: entry.currentHash,
      timestamp: new Date(entry.timestamp),
    });
  }

  async listAll(): Promise<AuditEntryData[]> {
    const result = await this.db.select().from(auditLog).orderBy(auditLog.timestamp);
    return result.map(mapAudit);
  }
}

function mapAudit(r: Record<string, unknown>): AuditEntryData {
  return {
    id: r['id'] as string,
    entryType: r['entry_type'] as string,
    payload: (r['payload'] as Record<string, unknown>) ?? {},
    previousHash: (r['previous_hash'] as string) ?? null,
    currentHash: r['current_hash'] as string,
    timestamp: r['timestamp'] instanceof Date
      ? (r['timestamp'] as Date).toISOString()
      : String(r['timestamp']),
  };
}

// ---- InMemory Implementation (for tests) ----
export class InMemoryObservabilityDB implements ObservabilityDatabase {
  tokenRecords: InMemoryTokenRepo;
  auditLog: InMemoryAuditRepo;

  constructor() {
    this.tokenRecords = new InMemoryTokenRepo();
    this.auditLog = new InMemoryAuditRepo();
  }

  clear(): void {
    this.tokenRecords.clear();
    this.auditLog.clear();
  }
}

class InMemoryTokenRepo {
  private store = new Map<string, TokenRecordData>();

  async insert(r: TokenRecordData) { this.store.set(r.id, { ...r }); }
  async findByPeriod(since: string): Promise<TokenRecordData[]> {
    const sinceDate = new Date(since);
    return Array.from(this.store.values()).filter(
      r => new Date(r.createdAt) >= sinceDate,
    );
  }
  clear() { this.store.clear(); }
}

class InMemoryAuditRepo {
  private store: AuditEntryData[] = [];

  async insert(e: AuditEntryData) { this.store.push({ ...e }); }
  async listAll(): Promise<AuditEntryData[]> {
    return [...this.store].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }
  clear() { this.store = []; }
}
