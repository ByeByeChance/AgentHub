import { z } from 'zod';

export const createConvSchema = z.object({
  title: z.string().optional(),
  mode: z.enum(['single', 'group']).optional(),
  agentIds: z.array(z.string()).min(1),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1),
  userMessageId: z.string().optional(),
  assistantMessageId: z.string().optional(),
});
