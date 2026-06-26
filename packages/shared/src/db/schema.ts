import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  customType,
} from 'drizzle-orm/pg-core';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';

// pgvector vector column type (embedding)
// Uses customType because drizzle-orm does not have native pgvector support
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${SERVICE_DEFAULTS.embedding.dimension})`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      return value.replace(/[[\]\s]/g, '').split(',').filter(Boolean).map(Number);
    }
    return Array.isArray(value) ? value : [];
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});

// ---- Agents Table ----
export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // e.g. "engineering", "marketing"
  systemPrompt: text('system_prompt').notNull(),
  adapterName: text('adapter_name').notNull().default('deepseek'),
  modelId: text('model_id').notNull().default('deepseek-v4-pro'),
  toolNames: jsonb('tool_names').$type<string[]>().notNull().default([]),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  isOrchestrator: boolean('is_orchestrator').notNull().default(false),
  nameI18n: jsonb('name_i18n').$type<Record<string, { name: string; description: string }>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---- Conversations Table ----
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default('New Conversation'),
  mode: text('mode').$type<'single' | 'group'>().notNull().default('single'),
  agentIds: jsonb('agent_ids').$type<string[]>().notNull().default([]),
  pinnedAt: timestamp('pinned_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---- Messages Table ----
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id),
  role: text('role').$type<'user' | 'assistant' | 'system'>().notNull(),
  parts: jsonb('parts').$type<MessagePart[]>().notNull().default([]),
  status: text('status')
    .$type<'streaming' | 'complete' | 'aborted' | 'failed'>()
    .notNull()
    .default('streaming'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

import type { MessagePart } from './repository.interface.js';

// ---- Documents Table (Knowledge Base, pgvector) ----
export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  metadata: jsonb('metadata').notNull().default({}),
  source: text('source'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---- Artifacts Table ----
export const artifacts = pgTable('artifacts', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id),
  type: text('type').$type<'web_app' | 'document' | 'code' | 'image'>().notNull(),
  title: text('title').notNull(),
  content: jsonb('content').notNull(),
  version: integer('version').notNull().default(1),
  parentArtifactId: text('parent_artifact_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
