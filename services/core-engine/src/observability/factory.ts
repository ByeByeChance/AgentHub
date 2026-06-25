import type { TokenRecorderLike, AuditLoggerLike } from '../services/interfaces/agent-runner.interface.js';
import type { Logger } from '@agenthub/shared/logging';
import { BestEffortTokenRecorder } from './best-effort-token-recorder.js';
import { BestEffortAuditLogger } from './best-effort-audit-logger.js';
import { HttpTokenRecorder } from './http-token-recorder.js';
import { HttpAuditLogger } from './http-audit-logger.js';

export interface ObservabilityClients {
  tokenRecorder: TokenRecorderLike;
  auditLogger: AuditLoggerLike;
}

/**
 * Create TokenRecorder and AuditLogger instances.
 *
 * When OBSERVABILITY_URL is configured (or explicitly opted in via
 * OBSERVABILITY_CLIENT=http), returns HTTP-client implementations
 * that POST to the observability service.
 *
 * Otherwise returns BestEffort implementations that log via structured
 * logger (no persistence, no cross-service dependency).
 */
export function createObservabilityClients(logger: Logger): ObservabilityClients {
  const clientMode = process.env.OBSERVABILITY_CLIENT ?? 'best-effort';
  const observabilityUrl = process.env.OBSERVABILITY_URL;

  if (clientMode === 'http' && observabilityUrl) {
    logger.info('Using HTTP observability clients', { url: observabilityUrl });
    return {
      tokenRecorder: new HttpTokenRecorder(logger, observabilityUrl),
      auditLogger: new HttpAuditLogger(logger, observabilityUrl),
    };
  }

  logger.info('Using best-effort observability clients (log-only)');
  return {
    tokenRecorder: new BestEffortTokenRecorder(logger),
    auditLogger: new BestEffortAuditLogger(logger),
  };
}
