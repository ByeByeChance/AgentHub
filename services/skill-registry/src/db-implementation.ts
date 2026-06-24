import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, like, or, and } from 'drizzle-orm';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { skills, skillVersions } from './schema.js';
import type { SkillDatabase, SkillRecord, SkillVersionRecord } from './repository.interface.js';
import * as schema from './schema.js';

// ---- Drizzle Implementation ----
export class DrizzleSkillDB implements SkillDatabase {
  skills: DrizzleSkillRepo;
  skillVersions: DrizzleSkillVersionRepo;

  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX) || SERVICE_DEFAULTS.dbPool.max,
      min: Number(process.env.DB_POOL_MIN) || SERVICE_DEFAULTS.dbPool.min,
    });
    const db = drizzle(this.pool, { schema });
    this.skills = new DrizzleSkillRepo(db);
    this.skillVersions = new DrizzleSkillVersionRepo(db);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class DrizzleSkillRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: SkillRecord): Promise<void> {
    await this.db.insert(skills).values({
      id: record.id,
      name: record.name,
      description: record.description,
      currentVersion: record.currentVersion,
      toolSet: record.toolSet,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  async findById(id: string): Promise<SkillRecord | null> {
    const result = await this.db.select().from(skills).where(eq(skills.id, id)).limit(1);
    if (result.length === 0) return null;
    return mapSkill(result[0]!);
  }

  async findByName(name: string): Promise<SkillRecord | null> {
    const result = await this.db.select().from(skills).where(eq(skills.name, name)).limit(1);
    if (result.length === 0) return null;
    return mapSkill(result[0]!);
  }

  async listAll(): Promise<SkillRecord[]> {
    const result = await this.db.select().from(skills);
    return result.map(mapSkill);
  }

  async search(query: string): Promise<SkillRecord[]> {
    const pattern = `%${query}%`;
    const result = await this.db.select().from(skills).where(
      or(like(skills.name, pattern), like(skills.description, pattern)),
    );
    return result.map(mapSkill);
  }

  async updateVersion(id: string, version: string): Promise<void> {
    await this.db
      .update(skills)
      .set({ currentVersion: version, updatedAt: new Date() })
      .where(eq(skills.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(skills).where(eq(skills.id, id));
  }
}

function mapSkill(r: Record<string, unknown>): SkillRecord {
  return {
    id: r['id'] as string,
    name: r['name'] as string,
    description: r['description'] as string,
    currentVersion: r['current_version'] as string,
    toolSet: (r['tool_set'] as string[]) ?? [],
    createdAt: r['created_at'] instanceof Date
      ? (r['created_at'] as Date).toISOString()
      : String(r['created_at']),
    updatedAt: r['updated_at'] instanceof Date
      ? (r['updated_at'] as Date).toISOString()
      : String(r['updated_at']),
  };
}

class DrizzleSkillVersionRepo {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async insert(record: SkillVersionRecord): Promise<void> {
    await this.db.insert(skillVersions).values({
      id: record.id,
      skillId: record.skillId,
      version: record.version,
      promptTemplate: record.promptTemplate,
      toolSet: record.toolSet,
      parameterSchema: record.parameterSchema as Record<string, unknown>,
      createdAt: new Date(record.createdAt),
    });
  }

  async findBySkillId(skillId: string): Promise<SkillVersionRecord[]> {
    const result = await this.db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.skillId, skillId))
      .orderBy(skillVersions.createdAt);
    return result.map(mapVersion);
  }

  async findBySkillIdAndVersion(
    skillId: string,
    version: string,
  ): Promise<SkillVersionRecord | null> {
    const result = await this.db
      .select()
      .from(skillVersions)
      .where(
        and(eq(skillVersions.skillId, skillId), eq(skillVersions.version, version)),
      )
      .limit(1);
    if (result.length === 0) return null;
    return mapVersion(result[0]!);
  }
}

function mapVersion(r: Record<string, unknown>): SkillVersionRecord {
  return {
    id: r['id'] as string,
    skillId: r['skill_id'] as string,
    version: r['version'] as string,
    promptTemplate: r['prompt_template'] as string,
    toolSet: (r['tool_set'] as string[]) ?? [],
    parameterSchema: (r['parameter_schema'] as Record<string, unknown>) ?? {},
    createdAt: r['created_at'] instanceof Date
      ? (r['created_at'] as Date).toISOString()
      : String(r['created_at']),
  };
}

// ---- InMemory Implementation (for tests) ----
export class InMemorySkillDB implements SkillDatabase {
  skills: InMemorySkillRepo;
  skillVersions: InMemorySkillVersionRepo;

  constructor() {
    this.skills = new InMemorySkillRepo();
    this.skillVersions = new InMemorySkillVersionRepo();
  }

  clear(): void {
    this.skills.clear();
    this.skillVersions.clear();
  }
}

class InMemorySkillRepo {
  private store = new Map<string, SkillRecord>();

  async insert(r: SkillRecord) { this.store.set(r.id, { ...r }); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByName(name: string) {
    for (const s of this.store.values()) {
      if (s.name === name) return s;
    }
    return null;
  }
  async listAll() { return Array.from(this.store.values()); }
  async search(query: string) {
    const l = query.toLowerCase();
    return Array.from(this.store.values()).filter(
      s => s.name.toLowerCase().includes(l) || s.description.toLowerCase().includes(l),
    );
  }
  async updateVersion(id: string, version: string) {
    const s = this.store.get(id);
    if (s) {
      s.currentVersion = version;
      s.updatedAt = new Date().toISOString();
    }
  }
  async delete(id: string) { this.store.delete(id); }
  clear() { this.store.clear(); }
}

class InMemorySkillVersionRepo {
  private store = new Map<string, SkillVersionRecord>();

  async insert(r: SkillVersionRecord) { this.store.set(r.id, { ...r }); }
  async findBySkillId(skillId: string) {
    return Array.from(this.store.values())
      .filter(v => v.skillId === skillId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async findBySkillIdAndVersion(skillId: string, version: string) {
    for (const v of this.store.values()) {
      if (v.skillId === skillId && v.version === version) return v;
    }
    return null;
  }
  clear() { this.store.clear(); }
}
