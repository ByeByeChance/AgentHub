import { z } from 'zod';

export const createAuditEntrySchema = z.object({
  entryType: z.string().min(1).max(128),
  payload: z.record(z.unknown()).default({}),
});

export type CreateAuditEntryInput = z.infer<typeof createAuditEntrySchema>;
