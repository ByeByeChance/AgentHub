import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpAuditLogger } from '../../observability/http-audit-logger.js';
import { BestEffortAuditLogger } from '../../observability/best-effort-audit-logger.js';
import type { Logger } from '@agenthub/shared/logging';

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger;
}

describe('HttpAuditLogger', () => {
  let logger: Logger;
  let auditLogger: HttpAuditLogger;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    logger = makeLogger();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should POST audit entry to the observability service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    auditLogger = new HttpAuditLogger(logger, 'http://obs:3004');
    await auditLogger.log({
      entryType: 'agent.run.failed',
      payload: { agentId: 'a1', error: 'timeout' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('http://obs:3004/api/obs/audit');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(call[1].body as string);
    expect(body.entryType).toBe('agent.run.failed');
    expect(body.payload).toEqual({ agentId: 'a1', error: 'timeout' });
  });

  it('should fall back to OBSERVABILITY_URL env var when no url passed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    vi.stubEnv('OBSERVABILITY_URL', 'http://env-obs:3004');

    auditLogger = new HttpAuditLogger(logger);
    await auditLogger.log({ entryType: 'test', payload: {} });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('http://env-obs:3004/api/obs/audit');
  });

  it('should warn when observability service returns non-ok status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    auditLogger = new HttpAuditLogger(logger, 'http://obs:3004');
    await auditLogger.log({ entryType: 'test', payload: {} });

    expect(logger.warn).toHaveBeenCalledWith(
      'Observability audit log returned non-ok status',
      expect.objectContaining({ status: 503 }),
    );
  });

  it('should never throw when fetch fails (best-effort)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    auditLogger = new HttpAuditLogger(logger, 'http://obs:3004');
    // Must not throw
    await expect(
      auditLogger.log({ entryType: 'test', payload: {} }),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to log audit entry to observability service',
      expect.objectContaining({ error: expect.stringContaining('Connection refused') }),
    );
  });

  it('should strip trailing slash from observability URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    auditLogger = new HttpAuditLogger(logger, 'http://obs:3004/');
    await auditLogger.log({ entryType: 'test', payload: {} });

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('http://obs:3004/api/obs/audit');
  });
});

describe('BestEffortAuditLogger', () => {
  it('should log audit entries via structured logger', async () => {
    const logger = makeLogger();
    const auditLogger = new BestEffortAuditLogger(logger);

    await auditLogger.log({
      entryType: 'agent.run.failed',
      payload: { agentId: 'a1', error: 'timeout' },
    });

    expect(logger.info).toHaveBeenCalledWith('Audit entry logged', expect.objectContaining({
      entryType: 'agent.run.failed',
      payload: { agentId: 'a1', error: 'timeout' },
    }));
  });
});
