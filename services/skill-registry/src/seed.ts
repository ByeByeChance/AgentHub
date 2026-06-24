import type { SkillRegistryOperations } from './operations.js';
import { BUILTIN_SKILL } from './constants/builtin-skill.js';

/**
 * Seeds the built-in "code-reviewer" skill.
 * Idempotent: will not create a duplicate if one already exists with the same name.
 */
export async function seedBuiltinSkills(
  ops: SkillRegistryOperations,
): Promise<void> {
  const existing = await ops.search(BUILTIN_SKILL.name);
  const exactMatch = existing.find((s) => s.name === BUILTIN_SKILL.name);
  if (!exactMatch) {
    await ops.create(BUILTIN_SKILL);
  }
}
