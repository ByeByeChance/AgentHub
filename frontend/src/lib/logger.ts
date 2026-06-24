type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const minLevel =
    (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) ?? 'info';
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function format(entry: LogEntry): void {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';

  switch (entry.level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(`${prefix} ${entry.message}${data}`);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(`${prefix} ${entry.message}${data}`);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(`${prefix} ${entry.message}${data}`);
  }
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  format({ level, message, data, timestamp: new Date().toISOString() });
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
};
