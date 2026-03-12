import { APP_ENV, ENABLE_VERBOSE_LOGS } from '../config/appConfig';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function shouldLog(level: LogLevel) {
  if (level === 'error' || level === 'warn') {
    return true;
  }

  if (ENABLE_VERBOSE_LOGS) {
    return true;
  }

  return APP_ENV !== 'production';
}

function serializeMeta(meta?: Record<string, unknown>) {
  if (!meta) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(meta));
}

function print(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = serializeMeta(meta);
  const prefix = `[nightowl:${level}]`;

  if (payload) {
    // eslint-disable-next-line no-console
    console[level](prefix, message, payload);
    return;
  }

  // eslint-disable-next-line no-console
  console[level](prefix, message);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => print('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => print('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => print('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => print('error', message, meta),
};
