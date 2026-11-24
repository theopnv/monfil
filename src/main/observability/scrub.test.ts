// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import type { Event } from '@sentry/electron/main';
import { createScrubber, LOG_BREADCRUMB_CATEGORY } from './scrub';

const mac = createScrubber({ homeDir: '/Users/jane', userDataDir: '/Users/jane/Library/Application Support/monfil' });
const windows = createScrubber({ homeDir: 'C:\\Users\\jane', userDataDir: 'C:\\Users\\jane\\AppData\\Roaming\\monfil' });

describe('string scrubbing', () => {
  test.each([
    ['replaces the home directory', 'ENOENT: /Users/jane/Documents/notes.txt', 'ENOENT: ~/Documents/notes.txt'],
    ['replaces the user data directory before the home directory', 'open /Users/jane/Library/Application Support/monfil/monfil.db failed', 'open <userData>/monfil.db failed'],
    ['replaces the home of another account', 'at /home/someone/app/main.js', 'at ~/app/main.js'],
    ['replaces a URL', 'fetch failed for https://private.example.com/feed.xml?token=abc', 'fetch failed for [url]'],
    ['replaces a URL of any scheme', 'blocked file:///Users/jane/secret.opml', 'blocked [url]'],
    ['replaces an email address', 'owner jane@example.com refused', 'owner [email] refused'],
  ])('%s', (_label, input, expected) => {
    // Act, Assert
    expect(mac.string(input)).toBe(expected);
  });

  test('replaces a Windows home directory with either separator and with escaped backslashes', () => {
    // Act, Assert
    expect(windows.string('C:\\Users\\jane\\AppData\\Roaming\\monfil\\monfil.db')).toBe('<userData>\\monfil.db');
    expect(windows.string('C:/Users/jane/Desktop/a.opml')).toBe('~/Desktop/a.opml');
    expect(windows.string('{"path":"C:\\\\Users\\\\jane\\\\Desktop\\\\a.opml"}')).toBe('{"path":"~\\\\Desktop\\\\a.opml"}');
  });

  test('does not touch a directory that only starts with the same letters', () => {
    // Act, Assert
    expect(mac.string('/Users/janet/file')).toBe('~/file');
    expect(mac.string('/Users/jane/x')).toBe('~/x');
  });

  test('works when the home directory is empty', () => {
    // Arrange
    const scrubber = createScrubber({ homeDir: '', userDataDir: '' });

    // Act, Assert
    expect(scrubber.string('plain text')).toBe('plain text');
  });
});

describe('event scrubbing', () => {
  const event: Event = {
    event_id: 'abc123',
    timestamp: 1700000000,
    platform: 'node',
    level: 'error',
    release: 'monfil@1.2.3',
    environment: 'github',
    fingerprint: ['system.failure', 'uncaughtException'],
    message: 'failed on https://reader.example.com/private',
    server_name: 'jane-macbook',
    user: { id: 'u1', email: 'jane@example.com', ip_address: '1.2.3.4', username: 'jane' },
    request: { url: 'file:///Users/jane/index.html', headers: { cookie: 'a=b' } },
    extra: { feed: 'My private feed' },
    modules: { electron: '45.0.0' },
    transaction: 'GET /feeds',
    tags: { incidentId: 'abcd1234', logEvent: 'system.failure', feedTitle: 'Private', 'event.process': 'browser' },
    contexts: {
      os: { name: 'macOS', version: '15.1', kernel_version: 'Darwin 24', hostname: 'jane-macbook' },
      device: { arch: 'arm64', name: 'Jane MacBook', memory_size: 123 },
      culture: { locale: 'fr-FR', timezone: 'Europe/Paris' },
      app: { app_name: 'monfil', app_version: '1.2.3', app_memory: 99 },
      trace: { trace_id: 't', span_id: 's' },
    },
    exception: {
      values: [{
        type: 'Error',
        value: 'ENOENT /Users/jane/Library/Application Support/monfil/monfil.db for https://feeds.example.com/a',
        mechanism: { type: 'generic', handled: false, data: { secret: 'x' } },
        stacktrace: {
          frames: [{
            filename: 'app:///Users/jane/dev/monfil/.vite/build/main.cjs',
            abs_path: '/Users/jane/dev/monfil/.vite/build/main.cjs',
            function: 'readFeed',
            lineno: 10,
            colno: 4,
            in_app: true,
            vars: { link: 'https://x.test' },
            context_line: 'const secret = 1;',
          }],
        },
      }],
    },
    debug_meta: { images: [{ type: 'sourcemap', debug_id: 'dbg-1', code_file: '/Users/jane/dev/monfil/.vite/build/main.cjs' }] },
    breadcrumbs: [
      { category: LOG_BREADCRUMB_CATEGORY, message: 'ipc.failure', level: 'error', data: { channel: 'feeds:list', feedId: 5, url: 'https://x.test' } },
      { category: 'console', message: 'user clicked https://x.test' },
    ],
  };

  test('keeps only the allowlisted fields', () => {
    // Act
    const scrubbed = mac.event(event);

    // Assert
    expect(scrubbed).toEqual({
      event_id: 'abc123',
      timestamp: 1700000000,
      platform: 'node',
      level: 'error',
      release: 'monfil@1.2.3',
      environment: 'github',
      fingerprint: ['system.failure', 'uncaughtException'],
      message: 'failed on [url]',
      tags: { incidentId: 'abcd1234', logEvent: 'system.failure', 'event.process': 'browser' },
      contexts: {
        os: { name: 'macOS', version: '15.1', kernel_version: 'Darwin 24' },
        device: { arch: 'arm64' },
        app: { app_name: 'monfil', app_version: '1.2.3' },
      },
      exception: {
        values: [{
          type: 'Error',
          value: 'ENOENT <userData>/monfil.db for [url]',
          mechanism: { type: 'generic', handled: false },
          stacktrace: { frames: [{ filename: 'app://~/dev/monfil/.vite/build/main.cjs', function: 'readFeed', lineno: 10, colno: 4, in_app: true }] },
        }],
      },
      debug_meta: { images: [{ type: 'sourcemap', debug_id: 'dbg-1', code_file: '~/dev/monfil/.vite/build/main.cjs' }] },
      breadcrumbs: [{ category: LOG_BREADCRUMB_CATEGORY, level: 'error', message: 'ipc.failure', data: { channel: 'feeds:list' } }],
    });
  });

  test('leaves no personal value in the serialized event', () => {
    // Act
    const serialized = JSON.stringify(mac.event(event));

    // Assert
    for (const secret of ['jane', 'example.com', 'Private', '1.2.3.4', 'fr-FR', 'Europe/Paris', 'cookie', 'secret']) {
      expect(serialized).not.toContain(secret);
    }
  });

  test('does not change the event it receives', () => {
    // Arrange
    const copy = structuredClone(event);

    // Act
    mac.event(event);

    // Assert
    expect(event).toEqual(copy);
  });

  test('keeps the text of a user report and the event it points to', () => {
    // Arrange
    const feedback: Event = {
      type: 'feedback',
      event_id: 'fb1',
      contexts: { feedback: { message: 'It broke when I opened settings', associated_event_id: 'abc123', contact_email: 'jane@example.com', name: 'Jane' } },
      user: { email: 'jane@example.com' },
    };

    // Act
    const scrubbed = mac.event(feedback);

    // Assert
    expect(scrubbed.contexts).toEqual({ feedback: { message: 'It broke when I opened settings', associated_event_id: 'abc123' } });
    expect(scrubbed.type).toBe('feedback');
    expect(scrubbed.user).toBeUndefined();
  });

  test('keeps an event that has no exception, no tags and no breadcrumbs', () => {
    // Act
    const scrubbed = mac.event({ event_id: 'e', message: 'startup failed' });

    // Assert
    expect(scrubbed).toEqual({ event_id: 'e', message: 'startup failed', contexts: {} });
  });
});

describe('breadcrumb scrubbing', () => {
  test('keeps a log breadcrumb with its enum fields only', () => {
    // Act
    const breadcrumb = mac.breadcrumb({
      category: LOG_BREADCRUMB_CATEGORY,
      message: 'feed.refresh',
      level: 'warning',
      timestamp: 12,
      data: { outcome: 'failed', errorCode: 'NETWORK_ERROR', feedId: 4, entityId: 2, message: 'x', link: 'https://x.test', nested: { a: 1 } },
    });

    // Assert
    expect(breadcrumb).toEqual({ category: LOG_BREADCRUMB_CATEGORY, level: 'warning', message: 'feed.refresh', timestamp: 12, data: { outcome: 'failed', errorCode: 'NETWORK_ERROR' } });
  });

  test.each([['console'], ['http'], ['electron'], ['ui.click'], [undefined]])('drops a breadcrumb of the %s category', (category) => {
    // Act, Assert
    expect(mac.breadcrumb({ ...(category === undefined ? {} : { category }), message: 'x' })).toBeNull();
  });

  test('scrubs a URL that slipped into an allowed field', () => {
    // Act
    const breadcrumb = mac.breadcrumb({ category: LOG_BREADCRUMB_CATEGORY, data: { source: 'https://x.test/a' } });

    // Assert
    expect(breadcrumb?.data).toEqual({ source: '[url]' });
  });
});

describe('allowlist contents', () => {
  const tags = ['incidentId', 'logEvent', 'source', 'channel', 'outcome', 'requestedSurface', 'errorName', 'startup', 'reason', 'event.process', 'event.origin', 'event.environment', 'process', 'handled', 'mechanism'];
  const contexts = {
    os: ['name', 'version', 'kernel_version'],
    device: ['arch'],
    runtime: ['name', 'version'],
    app: ['app_name', 'app_version'],
    browser: ['name', 'version'],
    chrome: ['name', 'version'],
    node: ['name', 'version'],
    electron: ['name', 'version'],
    feedback: ['message', 'associated_event_id'],
  };
  const breadcrumbFields = ['action', 'outcome', 'errorCode', 'channel', 'source', 'operation', 'requestedSurface', 'errorName'];

  test.each(tags)('keeps the tag %s', (tag) => {
    // Act
    const scrubbed = mac.event({ tags: { [tag]: 'value', other: 'x' } });

    // Assert
    expect(scrubbed.tags).toEqual({ [tag]: 'value' });
  });

  test.each(Object.entries(contexts))('keeps the fields of the %s context and nothing else', (name, fields) => {
    // Arrange
    const context = { ...Object.fromEntries(fields.map((field) => [field, `${field}-value`])), extra: 'x', nested: { a: 1 } };

    // Act
    const scrubbed = mac.event({ contexts: { [name]: context } });

    // Assert
    expect(scrubbed.contexts).toEqual({ [name]: Object.fromEntries(fields.map((field) => [field, `${field}-value`])) });
  });

  test.each(breadcrumbFields)('keeps the breadcrumb field %s', (field) => {
    // Act
    const breadcrumb = mac.breadcrumb({ category: LOG_BREADCRUMB_CATEGORY, data: { [field]: 'value', feedId: 3 } });

    // Assert
    expect(breadcrumb?.data).toEqual({ [field]: 'value' });
  });

  test('keeps numbers and booleans of an allowed field and drops objects and arrays', () => {
    // Act
    const scrubbed = mac.event({ contexts: { device: { arch: 'arm64' }, os: { name: { x: 1 }, version: 15, kernel_version: false } } as never });

    // Assert
    expect(scrubbed.contexts).toEqual({ device: { arch: 'arm64' }, os: { version: 15, kernel_version: false } });
  });

  test('leaves out a context or a tag list that has nothing allowed', () => {
    // Act
    const scrubbed = mac.event({ tags: { feedTitle: 'x' }, contexts: { os: { hostname: 'x' }, culture: { locale: 'fr' } } });

    // Assert
    expect(scrubbed).toEqual({ contexts: {} });
  });

  test('ignores a context that is not an object', () => {
    // Act
    const scrubbed = mac.event({ contexts: { os: 'macOS', device: ['arm64'] } as never });

    // Assert
    expect(scrubbed.contexts).toEqual({});
  });
});

describe('what the scrubber removes from text', () => {
  test.each([
    ['a plain address', 'mail jane@example.com now', 'mail [email] now'],
    ['an address with a plus and dots', 'a.b+c@sub.example.co.uk', '[email]'],
    ['an address with a hyphenated domain', 'x@my-host.example.org', '[email]'],
    ['two addresses', 'a@b.io and c@d.io', '[email] and [email]'],
  ])('replaces %s', (_label, input, expected) => {
    // Act, Assert
    expect(mac.string(input)).toBe(expected);
  });

  test('leaves an at sign that is not an address', () => {
    // Act, Assert
    expect(mac.string('at @scope/pkg and a@b')).toBe('at @scope/pkg and a@b');
  });

  test.each([
    ['a macOS home of another account', '/Users/someone/x/y.ts', '~/x/y.ts'],
    ['a Linux home of another account', '/home/someone/x', '~/x'],
    ['a Windows home of another account on C:', 'C:\\Users\\someone\\x', '~\\x'],
    ['a Windows home with forward slashes', 'D:/Users/someone/x', '~/x'],
    ['a Windows home with a lowercase drive', 'c:\\users\\someone\\x', '~\\x'],
  ])('replaces %s', (_label, input, expected) => {
    // Act, Assert
    expect(mac.string(input)).toBe(expected);
  });

  test('keeps a path that is not a home folder', () => {
    // Act, Assert
    expect(mac.string('/Applications/monfil.app/Contents/app.asar/main.cjs')).toBe('/Applications/monfil.app/Contents/app.asar/main.cjs');
  });

  test('does not read the dots of a folder name as any character', () => {
    // Arrange
    const scrubber = createScrubber({ homeDir: '/Users/j.ne', userDataDir: '/Users/j.ne/data' });

    // Act, Assert
    expect(scrubber.string('/Users/jxne/a /Users/j.ne/a')).toBe('~/a ~/a');
  });

  test('matches a folder name that has regex characters', () => {
    // Arrange
    const scrubber = createScrubber({ homeDir: '/Users/a+b(1)', userDataDir: '/x/y' });

    // Act, Assert
    expect(scrubber.string('open /Users/a+b(1)/f')).toBe('open ~/f');
  });

  test('matches a folder with repeated separators and a different case', () => {
    // Act, Assert
    expect(mac.string('//USERS//JANE/x')).toBe('/~/x');
  });

  test('replaces a relative folder that has no leading separator', () => {
    // Arrange
    const scrubber = createScrubber({ homeDir: 'home/jane', userDataDir: '' });

    // Act, Assert
    expect(scrubber.string('x home/jane/y')).toBe('x ~/y');
  });
});

describe('what the event keeps', () => {
  test('keeps the SDK name and version and nothing else of the SDK', () => {
    // Act
    const scrubbed = mac.event({ sdk: { name: 'sentry.javascript.electron', version: '8.4.0', integrations: ['A'], packages: [{ name: 'x', version: '1' }] } });

    // Assert
    expect(scrubbed.sdk).toEqual({ name: 'sentry.javascript.electron', version: '8.4.0' });
  });

  test('drops an SDK entry that has no version', () => {
    // Act
    const scrubbed = mac.event({ sdk: { name: 'sentry.javascript.electron' } as never });

    // Assert
    expect(scrubbed).not.toHaveProperty('sdk');
  });

  test('keeps the module of a frame and scrubs it', () => {
    // Act
    const scrubbed = mac.event({ exception: { values: [{ stacktrace: { frames: [{ module: '/Users/jane/x/mod', abs_path: '/Users/jane/x' }] } }] } });

    // Assert
    expect(scrubbed.exception?.values?.[0]?.stacktrace?.frames).toEqual([{ module: '~/x/mod' }]);
  });

  test('keeps the timestamp of a breadcrumb, even 0', () => {
    // Act
    const breadcrumb = mac.breadcrumb({ category: LOG_BREADCRUMB_CATEGORY, timestamp: 0 });

    // Assert
    expect(breadcrumb).toEqual({ category: LOG_BREADCRUMB_CATEGORY, timestamp: 0 });
  });

  test('keeps a mechanism that says nothing about being handled', () => {
    // Act
    const scrubbed = mac.event({ exception: { values: [{ mechanism: { type: 'generic' } }] } });

    // Assert
    expect(scrubbed.exception?.values?.[0]?.mechanism).toEqual({ type: 'generic' });
  });

  test('keeps every field of a debug image and drops the rest', () => {
    // Act
    const scrubbed = mac.event({ debug_meta: { images: [{ type: 'sourcemap', debug_id: 'd', code_id: 'c', image_addr: '0x1', image_size: 5, code_file: '/Users/jane/a', debug_file: '/Users/jane/b', arch: 'x' } as never, { name: 'x' } as never] } });

    // Assert
    expect(scrubbed.debug_meta).toEqual({ images: [{ type: 'sourcemap', debug_id: 'd', code_id: 'c', image_addr: '0x1', image_size: 5, code_file: '~/a', debug_file: '~/b' }] });
  });

  test('leaves out the debug metadata when no image is left', () => {
    // Act
    const scrubbed = mac.event({ debug_meta: { images: [] } });

    // Assert
    expect(scrubbed).not.toHaveProperty('debug_meta');
  });

  test.each(['event_id', 'timestamp', 'platform', 'level', 'type', 'release', 'environment', 'dist', 'fingerprint'] as const)('keeps %s only when it is set', (key) => {
    // Act
    const present = mac.event({ [key]: key === 'timestamp' ? 0 : 'v' } as never);
    const absent = mac.event({});

    // Assert
    expect(present[key]).toBe(key === 'timestamp' ? 0 : 'v');
    expect(absent).not.toHaveProperty(key);
  });

  test('keeps the breadcrumbs of an event only when it has some', () => {
    // Act
    const none = mac.event({});
    const empty = mac.event({ breadcrumbs: [] });

    // Assert
    expect(none).not.toHaveProperty('breadcrumbs');
    expect(empty.breadcrumbs).toEqual([]);
  });

  test('keeps an exception with only a type and drops one field at a time', () => {
    // Act
    const scrubbed = mac.event({ exception: { values: [{ type: 'Error' }, { value: 'v' }, {}] } });

    // Assert
    expect(scrubbed.exception?.values).toEqual([{ type: 'Error' }, { value: 'v' }, {}]);
  });
});
