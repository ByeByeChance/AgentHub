import type { FastifyInstance } from 'fastify';
import type { TokenRecorder } from './token-recorder.js';
import type { AuditLogger } from './audit-logger.js';
import { UnknownModelError } from './token-recorder.js';
import { recordTokenSchema } from './validation/token-schemas.js';
import { createAuditEntrySchema } from './validation/audit-schemas.js';
import { z } from 'zod';
import { TIME_PERIODS } from '@agenthub/shared/constants';

export function registerObservabilityRoutes(
  app: FastifyInstance,
  tokenRecorder: TokenRecorder,
  auditLogger: AuditLogger,
): void {
  // POST /api/obs/tokens — record token usage
  app.post('/api/obs/tokens', async (request, reply) => {
    try {
      const input = recordTokenSchema.parse(request.body);
      const record = await tokenRecorder.record(input);
      return reply.status(201).send(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      if (err instanceof UnknownModelError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // GET /api/obs/costs — cost aggregation
  app.get('/api/obs/costs', async (request, reply) => {
    const query = (request.query as Record<string, string> | undefined) ?? {};
    const period = (query['period'] as (typeof TIME_PERIODS)[number] | undefined) ?? TIME_PERIODS[0];
    if (!(TIME_PERIODS as readonly string[]).includes(period)) {
      return reply.status(400).send({ error: 'Invalid period. Use daily, weekly, or monthly.' });
    }
    const report = await tokenRecorder.getCosts({ period });
    return reply.send(report);
  });

  // POST /api/obs/audit — create audit entry
  app.post('/api/obs/audit', async (request, reply) => {
    try {
      const input = createAuditEntrySchema.parse(request.body);
      const entry = await auditLogger.log(input);
      return reply.status(201).send(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.errors });
      }
      throw err;
    }
  });

  // GET /api/obs/audit — retrieve audit log
  app.get('/api/obs/audit', async (_request, reply) => {
    const entries = await auditLogger.listAll();
    return reply.send(entries);
  });

  // GET /api/obs/audit/verify — verify chain integrity
  app.get('/api/obs/audit/verify', async (_request, reply) => {
    const result = await auditLogger.verifyChain();
    return reply.send(result);
  });
}
