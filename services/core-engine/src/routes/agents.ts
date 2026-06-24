import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AgentRegistry } from '../services/agent-registry.js';

const createAgentSchema = z.object({
  name: z.string().min(1),
  emoji: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  systemPrompt: z.string().min(1),
  toolNames: z.array(z.string()).optional(),
});

export function registerAgentRoutes(
  app: FastifyInstance,
  registry: AgentRegistry,
): void {
  app.get('/api/agents', async (request) => {
    const { category, search } = request.query as {
      category?: string;
      search?: string;
    };

    if (search) {
      return registry.search(search);
    }
    if (category) {
      return registry.listByCategory(category);
    }
    return registry.listAll();
  });

  app.get('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await registry.getById(id);
    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found' };
    }
    return agent;
  });

  app.post('/api/agents', async (request, reply) => {
    const result = createAgentSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return { error: 'Invalid request', details: result.error.issues };
    }
    const agent = await registry.create(result.data);
    reply.code(201);
    return agent;
  });
}
