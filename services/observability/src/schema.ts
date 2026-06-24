import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
} from 'drizzle-orm/pg-core';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';

// ---- Token Records Table ----
export const tokenRecords = pgTable('token_records', {
  id: text('id').primaryKey(),
  model: text('model').notNull(),
  tokensIn: integer('tokens_in').notNull(),
  tokensOut: integer('tokens_out').notNull(),
  cost: numeric('cost', { precision: 12, scale: SERVICE_DEFAULTS.cost.roundingPrecision }).notNull(),
  conversationId: text('conversation_id'),
  agentId: text('agent_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---- Audit Log Table (SHA-256 chained) ----
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  entryType: text('entry_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  previousHash: text('previous_hash'),
  currentHash: text('current_hash').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});
