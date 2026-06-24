import { describe, it, expect, vi } from 'vitest';
import { createPinoLogger } from '../../logging/pino-logger.js';

describe('createPinoLogger', () => {
  it('should forward log calls to pino', () => {
    const pino = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    const logger = createPinoLogger(pino as any);
    logger.info('test message', { key: 'value' });
    expect(pino.info).toHaveBeenCalledWith({ key: 'value' }, 'test message');
  });

  it('should create child loggers with layering bindings through pino child', () => {
    const childLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() };
    const pino = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnValue(childLogger),
    };
    const logger = createPinoLogger(pino as any, { service: 'test' });
    // Initial binding creates a child from the root pino
    expect(pino.child).toHaveBeenCalledWith({ service: 'test' });

    const child = logger.child({ component: 'x' });
    // The child() call delegates to childLogger.child with the new bindings
    expect(childLogger.child).toHaveBeenCalledWith({ component: 'x' });
    expect(child).toBeDefined();
  });

  it('should call pino.debug with empty object when no data provided', () => {
    const pino = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    const logger = createPinoLogger(pino as any);
    logger.debug('debug msg');
    expect(pino.debug).toHaveBeenCalledWith({}, 'debug msg');
  });

  it('should call pino.warn with data', () => {
    const pino = {
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    const logger = createPinoLogger(pino as any);
    logger.warn('warning', { code: 500 });
    expect(pino.warn).toHaveBeenCalledWith({ code: 500 }, 'warning');
  });

  it('should call pino.error with data', () => {
    const pino = {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    const logger = createPinoLogger(pino as any);
    logger.error('error msg', { stack: 'trace' });
    expect(pino.error).toHaveBeenCalledWith({ stack: 'trace' }, 'error msg');
  });
});
