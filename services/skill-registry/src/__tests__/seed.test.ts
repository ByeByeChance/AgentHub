import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistryOperations } from '../operations.js';
import { InMemorySkillDB } from '../db-implementation.js';
import { seedBuiltinSkills } from '../seed.js';

describe('seedBuiltinSkills', () => {
  let ops: SkillRegistryOperations;
  let db: InMemorySkillDB;

  beforeEach(() => {
    db = new InMemorySkillDB();
    ops = new SkillRegistryOperations(db);
  });

  it('should seed the code-reviewer skill', async () => {
    await seedBuiltinSkills(ops);
    const list = await ops.listAll();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('code-reviewer');
  });

  it('should be idempotent — running twice creates only one skill', async () => {
    await seedBuiltinSkills(ops);
    await seedBuiltinSkills(ops);
    const list = await ops.listAll();
    expect(list).toHaveLength(1);
  });

  it('should create skill with correct tool set', async () => {
    await seedBuiltinSkills(ops);
    const skill = await ops.getById(
      (await ops.listAll())[0]!.id,
    );
    expect(skill!.versions[0]!.toolSet).toContain('fs_read');
    expect(skill!.versions[0]!.toolSet).toContain('bash');
  });
});
