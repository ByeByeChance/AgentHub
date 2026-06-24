import type { AgentRegistry } from '../services/agent-registry.js';
import type { AgentSeedData } from './interfaces/seed.interface.js';
import { CATEGORY_TOOLS } from './constants/category-tools.js';

// gray-matter imports (dynamic, only when used)
async function getMatter() {
  return (await import('gray-matter')).default;
}

export async function parseAgentContent(
  content: string,
  filePath: string,
): Promise<AgentSeedData> {
  const matter = await getMatter();
  const parsed = matter(content);

  const frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
  const systemPrompt = (parsed.content ?? '').trim();

  const name = String(frontmatter['name'] ?? 'Unknown Agent');
  const emoji = String(frontmatter['emoji'] ?? '🤖');
  const description = String(
    frontmatter['description'] ?? frontmatter['vibe'] ?? 'No description',
  );

  // Extract category from file path: data/agency-agents/<category>/file.md
  const parts = filePath.replace(/\\/g, '/').split('/');
  const categoryIndex = parts.indexOf('agency-agents');
  const category =
    categoryIndex !== -1 && categoryIndex + 1 < parts.length
      ? parts[categoryIndex + 1] ?? 'specialized'
      : 'specialized';

  return { name, emoji, description, category, systemPrompt };
}

export async function seedAgents(
  registry: AgentRegistry,
  agentFiles: Array<{ path: string; content: string }>,
): Promise<number> {
  let imported = 0;

  for (const file of agentFiles) {
    try {
      const data = await parseAgentContent(file.content, file.path);

      // Check if already imported (idempotent by name + category)
      const existing = await registry.search(data.name);
      const alreadyExists = existing.some(
        (a) => a.name === data.name && a.category === data.category,
      );
      if (alreadyExists) continue;

      const toolNames = CATEGORY_TOOLS[data.category] ?? ['write_artifact'];

      await registry.create({
        name: data.name,
        emoji: data.emoji,
        description: data.description,
        category: data.category,
        systemPrompt: data.systemPrompt,
        toolNames,
      });

      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[seed] Failed to parse agent file, skipping: ${msg}`);
    }
  }

  return imported;
}

export function getToolsByCategory(category: string): string[] {
  return CATEGORY_TOOLS[category] ?? ['write_artifact'];
}
