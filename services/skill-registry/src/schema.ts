import {
  pgTable,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// ---- Skills Table ----
export const skills = pgTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  currentVersion: text('current_version').notNull(),
  toolSet: jsonb('tool_set').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---- Skill Versions Table (immutable) ----
export const skillVersions = pgTable('skill_versions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id')
    .notNull()
    .references(() => skills.id),
  version: text('version').notNull(),
  promptTemplate: text('prompt_template').notNull(),
  toolSet: jsonb('tool_set').$type<string[]>().notNull().default([]),
  parameterSchema: jsonb('parameter_schema').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
