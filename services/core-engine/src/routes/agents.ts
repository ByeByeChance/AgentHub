import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AgentRegistry } from '../services/agent-registry.js';
import { registerApiRoute } from '@agenthub/shared/server';
import { ProblemDetail, ERROR_TYPES } from '@agenthub/shared/errors';

const createAgentSchema = z.object({
  name: z.string().min(1),
  emoji: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  systemPrompt: z.string().min(1),
  toolNames: z.array(z.string()).optional(),
  nameI18n: z.record(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  })).optional(),
});

// ── Locale detection ────────────────────────────────────────────────

function parseAcceptLanguage(header?: string): string | undefined {
  if (!header) return undefined;
  // Extract primary locale: "zh-CN,zh;q=0.9,en;q=0.8" → "zh-CN"
  const first = header.split(',')[0]?.trim();
  if (!first) return undefined;
  return first.split(';')[0]?.trim();
}

function resolveLocale(
  queryLocale?: string,
  acceptLanguageHeader?: string,
): string | undefined {
  if (queryLocale) return queryLocale;
  return parseAcceptLanguage(acceptLanguageHeader);
}

export function registerAgentRoutes(
  app: FastifyInstance,
  registry: AgentRegistry,
): void {
  registerApiRoute(app, 'GET', '/agents', async (request) => {
    const { category, search, locale } = request.query as {
      category?: string;
      search?: string;
      locale?: string;
    };
    const resolvedLocale = resolveLocale(locale, request.headers['accept-language']);

    if (search) {
      return registry.search(search, resolvedLocale);
    }
    if (category) {
      return registry.listByCategory(category, resolvedLocale);
    }
    return registry.listAll(resolvedLocale);
  });

  registerApiRoute(app, 'GET', '/agents/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { locale } = request.query as { locale?: string };
    const resolvedLocale = resolveLocale(locale, request.headers['accept-language']);
    const agent = await registry.getById(id, resolvedLocale);
    if (!agent) {
      throw new ProblemDetail({
        type: ERROR_TYPES.NOT_FOUND,
        title: 'Not Found',
        status: 404,
        detail: 'Agent not found',
        instance: request.url,
      });
    }
    return agent;
  });

  registerApiRoute(app, 'POST', '/agents', async (request, reply) => {
    const result = createAgentSchema.safeParse(request.body);
    if (!result.success) {
      throw ProblemDetail.fromZodError(result.error, request.url);
    }
    const agent = await registry.create(result.data);
    reply.code(201);
    return agent;
  });
}
