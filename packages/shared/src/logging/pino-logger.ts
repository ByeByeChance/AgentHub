import type { Logger } from './logger.interface.js';

interface PinoLike {
  debug(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  child(bindings: Record<string, unknown>): PinoLike;
}

export function createPinoLogger(
  pinoInstance: PinoLike,
  bindings: Record<string, unknown> = {},
): Logger {
  const child = Object.keys(bindings).length > 0
    ? pinoInstance.child(bindings)
    : pinoInstance;

  return {
    debug: (msg, data) => child.debug(data ?? {}, msg),
    info: (msg, data) => child.info(data ?? {}, msg),
    warn: (msg, data) => child.warn(data ?? {}, msg),
    error: (msg, data) => child.error(data ?? {}, msg),
    child: (b) => createPinoLogger(child, b),
  };
}
