import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';

// ---- Agents Table ----
export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // e.g. "engineering", "marketing"
  systemPrompt: text('system_prompt').notNull(),
  adapterName: text('adapter_name').notNull().default('deepseek'),
  modelId: text('model_id').notNull().default('deepseek-v4-flash'),
  toolNames: jsonb('tool_names').$type<string[]>().notNull().default([]),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  isOrchestrator: boolean('is_orchestrator').notNull().default(false),
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

// Message part types for JSONB column
export interface MessagePart {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'artifact_ref';
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  artifactId?: string;
  isError?: boolean;
}

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
