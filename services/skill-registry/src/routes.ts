import type { FastifyInstance } from 'fastify';
import type { SkillRegistryOperations } from './operations.js';
import { createSkillSchema, publishVersionSchema } from './operations.js';
import { SkillAlreadyExistsError, SkillNotFoundError, InvalidVersionError } from './operations.js';
import { z } from 'zod';

export function registerSkillRoutes(
  app: FastifyInstance,
  ops: SkillRegistryOperations,
): void {
  // GET /api/skills — list all skills (optional ?search=)
  app.get('/api/skills', async (request, reply) => {
    const query = (request.query as Record<string, string> | undefined) ?? {};
    const search = query['search'];
    if (search && typeof search === 'string') {
      return reply.send(await ops.search(search));
    }
    return reply.send(await ops.listAll());
  });

  // GET /api/skills/:id — get skill by ID
  app.get('/api/skills/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const skill = await ops.getById(id);
    if (!skill) {
      return reply.status(404).send({ error: 'Skill not found' });
    }
    return reply.send(skill);
  });

  // GET /api/skills/:id/versions — list all versions of a skill
  app.get('/api/skills/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const skill = await ops.getById(id);
    if (!skill) {
      return reply.status(404).send({ error: 'Skill not found' });
    }
    return reply.send(await ops.listVersions(id));
  });

  // GET /api/skills/:id/versions/:version — get specific version
  app.get('/api/skills/:id/versions/:version', async (request, reply) => {
    const { id, version } = request.params as { id: string; version: string };
    const ver = await ops.getVersion(id, version);
    if (!ver) {
      return reply.status(404).send({ error: 'Version not found' });
    }
    return reply.send(ver);
  });

  // POST /api/skills — create new skill
  app.post('/api/skills', async (request, reply) => {
    try {
      const input = createSkillSchema.parse(request.body);
      const skill = await ops.create(input);
      return reply.status(201).send(skill);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      if (err instanceof SkillAlreadyExistsError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /api/skills/:id/versions — publish new version
  app.post('/api/skills/:id/versions', async (request, reply) => {
    try {
      const input = publishVersionSchema.parse(request.body);
      const version = await ops.publishVersion(
        (request.params as { id: string }).id,
        input,
      );
      return reply.status(201).send(version);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      if (err instanceof SkillNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof InvalidVersionError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
