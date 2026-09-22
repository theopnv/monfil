import electronLog from 'electron-log/main';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { LogEventMap, LogEventName, LogLevel, LogRecord } from '../../shared/logging';

export interface Logger {
  child(scope: string): Logger;
  debug<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void;
  info<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void;
  warn<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void;
  error<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void;
}

const SENSITIVE_KEYS = /(?:content|description|html|name|path|title|token|password|authorization|cookie|url|link)/i;

function safeMessage(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return '[redacted-url]';
      }
    })
    .replace(/(?:[A-Za-z]:\\|\/)(?:[^\s/:]+[\\/]){2,}[^\s]*/g, '[redacted-path]');
}

export function redact(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEYS.test(key)) {
    return '[redacted]';
  }
  if (typeof value === 'string') {
    return safeMessage(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, redact(entry, entryKey)]));
  }
  return value;
}

function serializeError(error: unknown): LogRecord['error'] | undefined {
  if (error === undefined) {
    return undefined;
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: safeMessage(error.message),
      ...(error.stack ? { stack: safeMessage(error.stack) } : {}),
    };
  }
  return { name: 'UnknownError', message: safeMessage(String(error)) };
}

class ElectronLogger implements Logger {
  constructor(private readonly scope: string) {}

  child(scope: string): Logger {
    return new ElectronLogger(`${this.scope}.${scope}`);
  }

  debug<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void {
    this.write('debug', event, data, error);
  }

  info<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void {
    this.write('info', event, data, error);
  }

  warn<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void {
    this.write('warn', event, data, error);
  }

  error<E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown): void {
    this.write('error', event, data, error);
  }

  private write<E extends LogEventName>(level: LogLevel, event: E, data: LogEventMap[E], error?: unknown): void {
    const errorRecord = serializeError(error);
    const record: LogRecord<E> = {
      level,
      event,
      scope: this.scope,
      timestamp: new Date().toISOString(),
      data: redact(data) as LogEventMap[E],
      ...(errorRecord ? { error: errorRecord } : {}),
    };
    electronLog[level](JSON.stringify(record));
  }
}

export const logger: Logger = new ElectronLogger('app');

export function configureLogging(logFilePath: string, detailed: boolean): void {
  mkdirSync(path.dirname(logFilePath), { recursive: true });
  appendFileSync(logFilePath, '');
  const development = process.env['NODE_ENV'] !== 'production';
  electronLog.transports.console.level = development ? 'debug' : 'info';
  electronLog.transports.file.level = detailed || development ? 'debug' : 'info';
  electronLog.transports.file.maxSize = 5 * 1024 * 1024;
  electronLog.transports.file.resolvePathFn = () => logFilePath;
  electronLog.transports.file.format = '{text}';
}

export function setDetailedLogging(detailed: boolean): void {
  electronLog.transports.file.level = detailed || process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info';
}
