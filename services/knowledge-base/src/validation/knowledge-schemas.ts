import { z } from 'zod';

export const addDocumentSchema = z.object({
  text: z.string().min(1),
  metadata: z.record(z.unknown()).optional().default({}),
  source: z.string().optional(),
  parentDocumentId: z.string().optional(),
});

export const searchQuerySchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.0),
  filters: z.record(z.unknown()).optional(),
});
