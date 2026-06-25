import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpTokenRecorder } from '../../observability/http-token-recorder.js';
import { BestEffortTokenRecorder } from '../../observability/best-effort-token-recorder.js';
import { createObservabilityClients } from '../../observability/factory.js';
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

describe('HttpTokenRecorder', () => {
  let logger: Logger;
  let recorder: HttpTokenRecorder;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    logger = makeLogger();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should POST token usage to the observability service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    recorder = new HttpTokenRecorder(logger, 'http://obs:3004');
    await recorder.record({
      model: 'deepseek-v4',
      tokensIn: 100,
      tokensOut: 50,
      conversationId: 'conv-1',
      agentId: 'agent-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('http://obs:3004/api/obs/tokens');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(call[1].body as string);
    expect(body.model).toBe('deepseek-v4');
    expect(body.tokensIn).toBe(100);
    expect(body.tokensOut).toBe(50);
    expect(body.conversationId).toBe('conv-1');
    expect(body.agentId).toBe('agent-1');
  });

  it('should fall back to OBSERVABILITY_URL env var when no url passed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    vi.stubEnv('OBSERVABILITY_URL', 'http://env-obs:3004');

    recorder = new HttpTokenRecorder(logger);
    await recorder.record({ model: 'm', tokensIn: 1, tokensOut: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('http://env-obs:3004/api/obs/tokens');
  });

  it('should warn when observability service returns non-ok status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    recorder = new HttpTokenRecorder(logger, 'http://obs:3004');
    await recorder.record({ model: 'm', tokensIn: 1, tokensOut: 2 });

    expect(logger.warn).toHaveBeenCalledWith(
      'Observability token record returned non-ok status',
      expect.objectContaining({ status: 503 }),
    );
  });

  it('should never throw when fetch fails (best-effort)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    recorder = new HttpTokenRecorder(logger, 'http://obs:3004');
    // Must not throw
    await expect(
      recorder.record({ model: 'm', tokensIn: 1, tokensOut: 2 }),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to record token usage to observability service',
      expect.objectContaining({ error: expect.stringContaining('Connection refused') }),
    );
  });

  it('should strip trailing slash from observability URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    recorder = new HttpTokenRecorder(logger, 'http://obs:3004/');
    await recorder.record({ model: 'm', tokensIn: 1, tokensOut: 2 });

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('http://obs:3004/api/obs/tokens');
  });
});

describe('BestEffortTokenRecorder', () => {
  it('should log token usage via structured logger', async () => {
    const logger = makeLogger();
    const recorder = new BestEffortTokenRecorder(logger);

    await recorder.record({
      model: 'deepseek-v4',
      tokensIn: 100,
      tokensOut: 50,
      conversationId: 'conv-1',
      agentId: 'agent-1',
    });

    expect(logger.info).toHaveBeenCalledWith('Token usage recorded', expect.objectContaining({
      model: 'deepseek-v4',
      tokensIn: 100,
      tokensOut: 50,
    }));
  });
});

describe('createObservabilityClients', () => {
  it('should return BestEffort clients by default', () => {
    const logger = makeLogger();
    const result = createObservabilityClients(logger);

    expect(result.tokenRecorder).toBeInstanceOf(BestEffortTokenRecorder);
    // Audit logger type check via name-like duck typing
    expect(result.auditLogger).toBeDefined();
  });

  it('should return BestEffort when OBSERVABILITY_CLIENT=http but no URL', () => {
    vi.stubEnv('OBSERVABILITY_CLIENT', 'http');
    vi.stubEnv('OBSERVABILITY_URL', '');

    const logger = makeLogger();
    const result = createObservabilityClients(logger);

    expect(result.tokenRecorder).toBeInstanceOf(BestEffortTokenRecorder);
  });

  it('should return HTTP clients when OBSERVABILITY_CLIENT=http and URL is set', () => {
    vi.stubEnv('OBSERVABILITY_CLIENT', 'http');
    vi.stubEnv('OBSERVABILITY_URL', 'http://obs:3004');

    const logger = makeLogger();
    const result = createObservabilityClients(logger);

    expect(result.tokenRecorder).toBeInstanceOf(HttpTokenRecorder);
  });
});
