// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { vi } from 'vitest';
import { configureLogging, logger, observeLogs, redact, serializeError, setDetailedLogging } from './logger';

const electronLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  transports: {
    console: {} as { level?: string },
    file: {} as { level?: string; maxSize?: number; format?: string; resolvePathFn?: () => string },
  },
}));

vi.mock(import('electron-log/main'), () => ({ default: electronLog as never }));

function lastRecord(level: 'debug' | 'info' | 'warn' | 'error'): Record<string, unknown> {
  return JSON.parse(String(electronLog[level].mock.lastCall?.[0])) as Record<string, unknown>;
}

describe('log redaction', () => {
  test('removes sensitive fields and keeps identifiers', () => {
    // Arrange
    const record = { feedId: 42, feedName: 'Private feed', url: 'https://user:secret@example.com/private', count: 3 };

    // Act
    const result = redact(record);

    // Assert
    expect(result).toEqual({ feedId: 42, feedName: '[redacted]', url: '[redacted]', count: 3 });
  });

  test.each(['content', 'description', 'html', 'name', 'path', 'title', 'token', 'password', 'authorization', 'cookie', 'url', 'link'])(
    'removes the value of a %s field, whatever its case or type',
    (key) => {
      // Act
      const result = redact({ [`my${key.toUpperCase()}`]: 123, [`${key}Text`]: { nested: 'x' }, [key]: 'secret' });

      // Assert
      expect(result).toEqual({ [`my${key.toUpperCase()}`]: '[redacted]', [`${key}Text`]: '[redacted]', [key]: '[redacted]' });
    },
  );

  test('keeps values that are not strings, arrays or objects', () => {
    // Act
    const result = redact({ a: 1, b: true, c: null, d: undefined });

    // Assert
    expect(result).toStrictEqual({ a: 1, b: true, c: null, d: undefined });
  });

  test('keeps a string that holds no URL and no path', () => {
    // Act, Assert
    expect(redact('Could not parse the feed')).toBe('Could not parse the feed');
  });

  test('removes paths from error text', () => {
    // Arrange
    const sensitivePath = ['', 'Users', 'person', 'Library', 'Application Support', 'monfil', 'data.db'].join('/');
    const message = `Failed at ${sensitivePath}`;

    // Act
    const result = redact(message);

    // Assert
    expect(result).not.toContain(sensitivePath);
  });

  test('replaces a POSIX path with a marker and keeps the text around it', () => {
    // Act
    const result = redact('Failed at /Users/person/Library/monfil/data.db while saving');

    // Assert
    expect(result).toBe('Failed at [redacted-path] while saving');
  });

  test('replaces a Windows path with a marker and keeps the text around it', () => {
    // Act
    const result = redact(String.raw`Failed at C:\Users\person\AppData\monfil\data.db while saving`);

    // Assert
    expect(result).toBe('Failed at [redacted-path] while saving');
  });

  test('replaces a Windows path with forward slashes', () => {
    // Act
    const result = redact('Failed at d:\\Users/person/monfil/data.db');

    // Assert
    expect(result).toBe('Failed at [redacted-path]');
  });

  test('reduces a URL to its host, without credentials, path or query', () => {
    // Act
    const result = redact('Could not fetch https://user:secret@Example.com:8080/private/feed.xml?token=abc retrying');

    // Assert
    expect(result).toBe('Could not fetch example.com retrying');
  });

  test('reduces an http URL and stops at a closing parenthesis', () => {
    // Act
    const result = redact('Redirected (HTTP://news.example.org/a/b) twice');

    // Assert
    expect(result).toBe('Redirected (news.example.org) twice');
  });

  test('replaces a URL that cannot be parsed with a marker', () => {
    // Act
    const result = redact('Bad link http://%zz here');

    // Assert
    expect(result).toBe('Bad link [redacted-url] here');
  });

  test('redacts strings inside nested arrays and objects', () => {
    // Arrange
    const record = {
      steps: [
        'fetch https://example.com/secret/feed',
        { note: 'wrote /Users/person/Library/monfil/data.db', title: 'Private', list: ['C:\\Users\\person\\x\\y.db', 7] },
      ],
    };

    // Act
    const result = redact(record);

    // Assert
    expect(result).toEqual({
      steps: [
        'fetch example.com',
        { note: 'wrote [redacted-path]', title: '[redacted]', list: ['[redacted-path]', 7] },
      ],
    });
  });

  test('does not apply the key of an array to its items', () => {
    // Act
    const result = redact({ items: ['plain'] });

    // Assert
    expect(result).toEqual({ items: ['plain'] });
  });
});

describe('log errors', () => {
  test('returns nothing when there is no error', () => {
    // Act, Assert
    expect(serializeError(undefined)).toBeUndefined();
  });

  test('serializes a tagged error object', () => {
    // Arrange
    const error = { name: 'NETWORK_ERROR', message: 'Could not resolve example.com.' };

    // Act
    const result = serializeError(error);

    // Assert
    expect(result).toEqual(error);
  });

  test('removes URLs and paths from a tagged error object', () => {
    // Arrange
    const error = { name: 'FAILED https://a.example/x', message: 'Cannot read /Users/person/Library/monfil/data.db' };

    // Act
    const result = serializeError(error);

    // Assert
    expect(result).toStrictEqual({ name: 'FAILED a.example', message: 'Cannot read [redacted-path]' });
  });

  test('serializes an Error with its name, message and stack, without URLs or paths', () => {
    // Arrange
    const error = new TypeError('Cannot load https://example.com/private/feed.xml');
    error.stack = 'TypeError: Cannot load https://example.com/private/feed.xml\n    at load (/Users/person/dev/monfil/src/feed.ts:10:5)';

    // Act
    const result = serializeError(error);

    // Assert
    expect(result).toStrictEqual({
      name: 'TypeError',
      message: 'Cannot load example.com',
      stack: 'TypeError: Cannot load example.com\n    at load ([redacted-path]',
    });
  });

  test('leaves the stack out of an Error that has none', () => {
    // Arrange
    const error = new Error('boom');
    delete error.stack;

    // Act
    const result = serializeError(error);

    // Assert
    expect(result).toStrictEqual({ name: 'Error', message: 'boom' });
  });

  test('leaves the stack out of an Error whose stack is empty', () => {
    // Arrange
    const error = new Error('boom');
    error.stack = '';

    // Act
    const result = serializeError(error);

    // Assert
    expect(result).toStrictEqual({ name: 'Error', message: 'boom' });
  });

  test.each([
    ['a string', 'Disk full at /Users/person/Library/monfil/data.db', 'Disk full at [redacted-path]'],
    ['a number', 42, '42'],
    ['null', null, 'null'],
    ['an object without a name', { message: 'x' }, '[object Object]'],
    ['an object without a message', { name: 'X' }, '[object Object]'],
    ['an object with a name that is not a string', { name: 1, message: 'x' }, '[object Object]'],
    ['an object with a message that is not a string', { name: 'X', message: 2 }, '[object Object]'],
  ])('serializes %s as an unknown error', (_label, error, message) => {
    // Act
    const result = serializeError(error);

    // Assert
    expect(result).toStrictEqual({ name: 'UnknownError', message });
  });
});

describe('log records', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test.each(['debug', 'info', 'warn', 'error'] as const)('%s writes one JSON record to the log at that level', (level) => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T10:00:00.000Z'));

    // Act
    logger[level]('feed.refresh', { outcome: 'failed', feedId: 7, errorCode: 'see https://example.com/a/b' }, new Error('boom'));

    // Assert
    expect(electronLog[level]).toHaveBeenCalledOnce();
    expect(lastRecord(level)).toMatchObject({
      level,
      event: 'feed.refresh',
      scope: 'app',
      timestamp: '2026-10-27T10:00:00.000Z',
      data: { outcome: 'failed', feedId: 7, errorCode: 'see example.com' },
      error: { name: 'Error', message: 'boom' },
    });
  });

  test('omits the error from a record without an error', () => {
    // Act
    logger.info('app.lifecycle', { action: 'start' });

    // Assert
    expect(lastRecord('info')).not.toHaveProperty('error');
  });

  test('a child logger adds its name to the scope', () => {
    // Act
    logger.child('feed').child('refresh').info('app.lifecycle', { action: 'start' });

    // Assert
    expect(lastRecord('info')['scope']).toBe('app.feed.refresh');
  });

  test('writes redacted data to the log and gives the observer the original data', () => {
    // Arrange
    const observer = vi.fn();
    const stop = observeLogs(observer);
    const data = { message: 'failed at /Users/person/Library/monfil/data.db' };

    // Act
    logger.warn('renderer.failure', data);
    stop();

    // Assert
    expect(lastRecord('warn')['data']).toEqual({ message: 'failed at [redacted-path]' });
    expect(observer).toHaveBeenCalledExactlyOnceWith('renderer.failure', data, 'warn');
  });
});

describe('log observers', () => {
  test('receive each record until they are removed', () => {
    // Arrange
    const observer = vi.fn();
    const stop = observeLogs(observer);

    // Act
    logger.warn('app.lifecycle', { action: 'one' });
    stop();
    logger.warn('app.lifecycle', { action: 'two' });

    // Assert
    expect(observer).toHaveBeenCalledExactlyOnceWith('app.lifecycle', { action: 'one' }, 'warn');
  });

  test('cannot break logging by throwing', () => {
    // Arrange
    const stop = observeLogs(() => {
      throw new Error('observer failed');
    });

    // Act, Assert
    expect(() => logger.error('app.lifecycle', { action: 'x' })).not.toThrow();
    stop();
  });

  test('a throwing observer does not stop the next observers', () => {
    // Arrange
    const next = vi.fn();
    const stopFirst = observeLogs(() => {
      throw new Error('observer failed');
    });
    const stopNext = observeLogs(next);

    // Act
    logger.error('app.lifecycle', { action: 'x' });
    stopFirst();
    stopNext();

    // Assert
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('log file setup', () => {
  let directory = '';

  afterEach(() => {
    vi.unstubAllEnvs();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = '';
    }
  });

  function configure(detailed: boolean): string {
    directory = mkdtempSync(path.join(tmpdir(), 'monfil-log-'));
    const logFile = path.join(directory, 'nested', 'logs', 'main.log');
    configureLogging(logFile, detailed);
    return logFile;
  }

  test('creates the log file and its folders, and writes the text of each record as is', () => {
    // Act
    const logFile = configure(false);

    // Assert
    expect(readFileSync(logFile, 'utf8')).toBe('');
    expect(electronLog.transports.file.resolvePathFn?.()).toBe(logFile);
    expect(electronLog.transports.file.format).toBe('{text}');
    expect(electronLog.transports.file.maxSize).toBe(5 * 1024 * 1024);
  });

  test.each([
    ['production', false, 'info', 'info'],
    ['production', true, 'info', 'debug'],
    ['development', false, 'debug', 'debug'],
    ['development', true, 'debug', 'debug'],
  ])('in %s with detailed=%s, the console level is %s and the file level is %s', (environment, detailed, consoleLevel, fileLevel) => {
    // Arrange
    vi.stubEnv('NODE_ENV', environment);

    // Act
    configure(detailed);

    // Assert
    expect(electronLog.transports.console.level).toBe(consoleLevel);
    expect(electronLog.transports.file.level).toBe(fileLevel);
  });

  test.each([
    ['production', false, 'info'],
    ['production', true, 'debug'],
    ['development', false, 'debug'],
    ['development', true, 'debug'],
  ])('in %s, setting detailed=%s puts the file level at %s', (environment, detailed, fileLevel) => {
    // Arrange
    vi.stubEnv('NODE_ENV', environment);

    // Act
    setDetailedLogging(detailed);

    // Assert
    expect(electronLog.transports.file.level).toBe(fileLevel);
  });
});
