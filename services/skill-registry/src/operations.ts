import { randomUUID } from 'node:crypto';
import semver from 'semver';
import type { SkillDatabase, SkillRecord, SkillVersionRecord } from './repository.interface.js';
import { createSkillSchema, publishVersionSchema } from './validation/skill-schemas.js';
import type { CreateSkillInput, PublishVersionInput } from './validation/skill-schemas.js';
import type { SkillMetadata, SkillFull } from './interfaces/skill.interface.js';

// ---- Operations ----
export class SkillRegistryOperations {
  constructor(private db: SkillDatabase) {}

  async create(input: CreateSkillInput): Promise<SkillFull> {
    const parsed = createSkillSchema.parse(input);

    // Check for duplicate name
    const existing = await this.db.skills.findByName(parsed.name);
    if (existing) {
      throw new SkillAlreadyExistsError(parsed.name);
    }

    const skillId = randomUUID();
    const versionId = randomUUID();
    const now = new Date().toISOString();

    const skill: SkillRecord = {
      id: skillId,
      name: parsed.name,
      description: parsed.description,
      currentVersion: '1.0.0',
      toolSet: parsed.toolSet,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.skills.insert(skill);

    const version: SkillVersionRecord = {
      id: versionId,
      skillId,
      version: '1.0.0',
      promptTemplate: parsed.promptTemplate,
      toolSet: parsed.toolSet,
      parameterSchema: parsed.parameterSchema,
      createdAt: now,
    };

    await this.db.skillVersions.insert(version);

    return { ...skill, versions: [version] };
  }

  async getById(id: string): Promise<SkillFull | null> {
    const skill = await this.db.skills.findById(id);
    if (!skill) return null;

    const versions = await this.db.skillVersions.findBySkillId(id);
    return { ...skill, versions };
  }

  async listAll(): Promise<SkillMetadata[]> {
    return this.db.skills.listAll();
  }

  async search(query: string): Promise<SkillMetadata[]> {
    return this.db.skills.search(query);
  }

  async publishVersion(
    skillId: string,
    input: PublishVersionInput,
  ): Promise<SkillVersionRecord> {
    const parsed = publishVersionSchema.parse(input);

    const skill = await this.db.skills.findById(skillId);
    if (!skill) {
      throw new SkillNotFoundError(skillId);
    }

    // Determine new version
    let newVersion: string;
    if (parsed.version) {
      // Explicit version: verify it's greater than current
      if (!semver.gt(parsed.version, skill.currentVersion)) {
        throw new InvalidVersionError(
          `Version ${parsed.version} must be greater than current ${skill.currentVersion}`,
        );
      }
      newVersion = parsed.version;
    } else {
      // Auto-bump patch version
      newVersion = semver.inc(skill.currentVersion, 'patch') ?? '1.0.1';
    }

    const versionId = randomUUID();
    const now = new Date().toISOString();

    const versionRecord: SkillVersionRecord = {
      id: versionId,
      skillId,
      version: newVersion,
      promptTemplate: parsed.promptTemplate,
      toolSet: parsed.toolSet,
      parameterSchema: parsed.parameterSchema,
      createdAt: now,
    };

    await this.db.skillVersions.insert(versionRecord);
    await this.db.skills.updateVersion(skillId, newVersion);

    return versionRecord;
  }

  async getVersion(
    skillId: string,
    version: string,
  ): Promise<SkillVersionRecord | null> {
    return this.db.skillVersions.findBySkillIdAndVersion(skillId, version);
  }

  async listVersions(skillId: string): Promise<SkillVersionRecord[]> {
    return this.db.skillVersions.findBySkillId(skillId);
  }
}

// ---- Custom Errors ----
export class SkillAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Skill with name "${name}" already exists`);
    this.name = 'SkillAlreadyExistsError';
  }
}

export class SkillNotFoundError extends Error {
  constructor(id: string) {
    super(`Skill with id "${id}" not found`);
    this.name = 'SkillNotFoundError';
  }
}

export class InvalidVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidVersionError';
  }
}
