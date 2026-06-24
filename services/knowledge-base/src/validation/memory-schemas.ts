import { z } from 'zod';

export const shortTermSchema = z.object({
  conversationId: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string(),
  })),
});

export const workingMemorySchema = z.object({
  conversationId: z.string().min(1),
  entries: z.array(z.object({
    key: z.string().min(1),
    // value is required but can be any JSON-compatible value
    value: z.unknown().transform(v => v),
    ttl: z.number().positive().optional(),
  })),
});
