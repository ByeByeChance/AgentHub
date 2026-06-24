import { z } from 'zod';
import semver from 'semver';

export const createSkillSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().min(1),
  toolSet: z.array(z.string()).optional().default([]),
  promptTemplate: z.string().min(1),
  parameterSchema: z.record(z.unknown()).optional().default({}),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const publishVersionSchema = z.object({
  promptTemplate: z.string().min(1),
  toolSet: z.array(z.string()).optional().default([]),
  parameterSchema: z.record(z.unknown()).optional().default({}),
  version: z.string().refine((v) => semver.valid(v), 'Invalid semver version').optional(),
});

export type PublishVersionInput = z.infer<typeof publishVersionSchema>;
