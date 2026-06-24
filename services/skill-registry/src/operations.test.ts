import { describe, it, expect, beforeEach } from 'vitest';
import {
  SkillRegistryOperations,
  SkillAlreadyExistsError,
  SkillNotFoundError,
  InvalidVersionError,
  createSkillSchema,
  publishVersionSchema,
} from './operations.js';
import { InMemorySkillDB } from './db-implementation.js';
import type { CreateSkillInput, PublishVersionInput } from './operations.js';

function validCreateInput(): CreateSkillInput {
  return {
    name: 'code-reviewer',
    description: 'Review code changes systematically',
    toolSet: ['fs_read', 'bash'],
    promptTemplate: 'You are a code reviewer. Analyze the diff and suggest improvements.',
    parameterSchema: { diff: { type: 'string' }, language: { type: 'string' } },
  };
}

describe('SkillRegistryOperations', () => {
  let ops: SkillRegistryOperations;
  let db: InMemorySkillDB;

  beforeEach(() => {
    db = new InMemorySkillDB();
    ops = new SkillRegistryOperations(db);
  });

  describe('create', () => {
    it('should create a skill and retrieve it by ID', async () => {
      const created = await ops.create(validCreateInput());
      expect(created.id).toBeDefined();
      expect(created.name).toBe('code-reviewer');
      expect(created.currentVersion).toBe('1.0.0');
      expect(created.versions).toHaveLength(1);
      expect(created.versions[0]!.version).toBe('1.0.0');
    });

    it('should create a skill with initial version v1.0.0', async () => {
      const created = await ops.create(validCreateInput());
      expect(created.currentVersion).toBe('1.0.0');
      expect(created.versions[0]!.promptTemplate).toContain('code reviewer');
    });

    it('should reject duplicate skill names', async () => {
      await ops.create(validCreateInput());
      await expect(ops.create(validCreateInput())).rejects.toThrow(
        SkillAlreadyExistsError,
      );
    });

    it('should store prompt template and parameter schema in version', async () => {
      const created = await ops.create(validCreateInput());
      expect(created.versions[0]!.parameterSchema).toEqual({
        diff: { type: 'string' },
        language: { type: 'string' },
      });
    });
  });

  describe('getById', () => {
    it('should return skill with versions', async () => {
      const created = await ops.create(validCreateInput());
      const found = await ops.getById(created.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('code-reviewer');
      expect(found!.versions).toHaveLength(1);
    });

    it('should return null for non-existent skill', async () => {
      const found = await ops.getById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('listAll', () => {
    it('should return empty list when no skills exist', async () => {
      const list = await ops.listAll();
      expect(list).toEqual([]);
    });

    it('should list all created skills', async () => {
      await ops.create(validCreateInput());
      await ops.create({ ...validCreateInput(), name: 'test-runner' });
      const list = await ops.listAll();
      expect(list).toHaveLength(2);
    });
  });

  describe('search', () => {
    it('should search skills by name', async () => {
      await ops.create(validCreateInput());
      const results = await ops.search('code');
      expect(results).toHaveLength(1);
    });

    it('should search skills by description', async () => {
      await ops.create(validCreateInput());
      const results = await ops.search('systematically');
      expect(results).toHaveLength(1);
    });

    it('should return empty array when no match', async () => {
      const results = await ops.search('nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('publishVersion', () => {
    it('should publish a new version and bump current version', async () => {
      const created = await ops.create(validCreateInput());
      const newVersion = await ops.publishVersion(created.id, {
        promptTemplate: 'Updated template',
      } as PublishVersionInput);
      expect(newVersion.version).toBe('1.0.1');
      expect(newVersion.promptTemplate).toBe('Updated template');

      const updated = await ops.getById(created.id);
      expect(updated!.currentVersion).toBe('1.0.1');
      expect(updated!.versions).toHaveLength(2);
    });

    it('should allow explicit version bump', async () => {
      const created = await ops.create(validCreateInput());
      const newVersion = await ops.publishVersion(created.id, {
        promptTemplate: 'Major update',
        version: '2.0.0',
      } as PublishVersionInput);
      expect(newVersion.version).toBe('2.0.0');
    });

    it('should reject version lower than current', async () => {
      const created = await ops.create(validCreateInput());
      await expect(
        ops.publishVersion(created.id, {
          promptTemplate: 'Downgrade',
          version: '0.9.0',
        } as PublishVersionInput),
      ).rejects.toThrow(InvalidVersionError);
    });

    it('should throw SkillNotFoundError for non-existent skill', async () => {
      await expect(
        ops.publishVersion('nonexistent', { promptTemplate: 'Test' } as PublishVersionInput),
      ).rejects.toThrow(SkillNotFoundError);
    });
  });

  describe('getVersion', () => {
    it('should retrieve a specific version', async () => {
      const created = await ops.create(validCreateInput());
      const version = await ops.getVersion(created.id, '1.0.0');
      expect(version).toBeDefined();
      expect(version!.version).toBe('1.0.0');
    });

    it('should return null for unknown version', async () => {
      const created = await ops.create(validCreateInput());
      const version = await ops.getVersion(created.id, '9.9.9');
      expect(version).toBeNull();
    });
  });

  describe('listVersions', () => {
    it('should list all versions in chronological order', async () => {
      const created = await ops.create(validCreateInput());
      await ops.publishVersion(created.id, { promptTemplate: 'v2' } as PublishVersionInput);
      await ops.publishVersion(created.id, { promptTemplate: 'v3' } as PublishVersionInput);

      const versions = await ops.listVersions(created.id);
      expect(versions).toHaveLength(3);
      expect(versions[0]!.version).toBe('1.0.0');
      expect(versions[1]!.version).toBe('1.0.1');
      expect(versions[2]!.version).toBe('1.0.2');
    });
  });

  describe('Zod validation', () => {
    it('should reject empty name via Zod', () => {
      expect(() => createSkillSchema.parse({ ...validCreateInput(), name: '' })).toThrow();
    });

    it('should reject empty prompt template via Zod', () => {
      expect(() => publishVersionSchema.parse({ promptTemplate: '' })).toThrow();
    });

    it('should reject name exceeding 128 characters', () => {
      expect(() =>
        createSkillSchema.parse({ ...validCreateInput(), name: 'x'.repeat(129) }),
      ).toThrow();
    });

    it('should reject version with invalid semver', () => {
      expect(() =>
        publishVersionSchema.parse({ promptTemplate: 'x', version: 'not-semver' }),
      ).toThrow();
    });
  });
});
