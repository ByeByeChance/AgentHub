#!/usr/bin/env tsx
/**
 * CLI entry point for seeding the database with agent definitions.
 *
 * Usage: pnpm --filter @agenthub/core-engine db:seed
 *
 * Reads agent markdown files from data/agency-agents/ and imports them
 * into the agents table (idempotent — skips duplicates by name + category).
 */
import { InMemoryDB, DrizzleDB, type Database } from '@agenthub/shared/db';
import { AgentRegistry } from '../services/agent-registry.js';
import { seedAgents } from './seed.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const AGENTS_DIR = join(process.cwd(), 'data', 'agency-agents');

async function collectAgentFiles(dir: string): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories (.github, etc.) and non-category dirs (scripts)
        if (entry.name.startsWith('.') || entry.name === 'scripts') continue;
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && extname(entry.name) === '.md' && depth > 0) {
        // Only collect .md files inside category subdirectories (depth > 0)
        const content = await readFile(fullPath, 'utf-8');
        files.push({ path: fullPath, content });
      }
    }
  }

  try {
    await stat(dir);
    await walk(dir, 0);
  } catch {
    console.warn(`[seed] Agent directory not found: ${dir}. Skipping seed.`);
  }

  return files;
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  const db: Database = dbUrl ? new DrizzleDB(dbUrl) : new InMemoryDB();
  const registry = new AgentRegistry(db);

  const agentFiles = await collectAgentFiles(AGENTS_DIR);
  if (agentFiles.length === 0) {
    console.log('[seed] No agent markdown files found. Nothing to import.');
    process.exit(0);
  }

  console.log(`[seed] Found ${agentFiles.length} agent file(s). Importing...`);
  const imported = await seedAgents(registry, agentFiles);
  console.log(`[seed] Imported ${imported} new agent(s) (${agentFiles.length - imported} already existed).`);

  if (db instanceof DrizzleDB) await db.close();
  process.exit(0);
}

void main();
