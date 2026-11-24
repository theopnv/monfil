// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import path from 'node:path';
import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resolveEnvironment } from './environment';
import type { ReportSink } from './routing';

const userData = path.join('/data', 'monfil');
const crashDumps = path.join('/data', 'Crashpad');

const sdk = vi.hoisted(() => {
  const hooks: Record<string, ((event: Record<string, unknown>) => void) | undefined> = {};
  const client = {
    getOptions: () => client.options,
    options: { enabled: true as boolean | undefined },
    on: vi.fn((name: string, hook: (event: Record<string, unknown>) => void) => {
      hooks[name] = hook;
    }),
  };
  return {
    hooks,
    client,
    init: vi.fn(),
    getDefaultIntegrations: vi.fn(() => ['SentryMinidump', 'ElectronBreadcrumbs', 'ElectronNet', 'ChildProcess', 'OnUncaughtException', 'PreloadInjection', 'Screenshots', 'AdditionalContext', 'MainProcessSession', 'Console', 'Context', 'NormalizePaths'].map((name) => ({ name }))),
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(() => 'event-exception'),
    captureMessage: vi.fn(() => 'event-message'),
    scope: { setTags: vi.fn(), setLevel: vi.fn(), setFingerprint: vi.fn() },
  };
});

vi.mock(import('electron'), () => ({ app: { getPath: (name: string) => (name === 'crashDumps' ? crashDumps : userData), getVersion: () => '1.2.3' } }) as never);
vi.mock(import('node:fs/promises'), () => ({ rm: vi.fn(() => Promise.resolve()) }) as never);
vi.mock(import('@sentry/electron/main'), () => ({
  init: sdk.init,
  getDefaultIntegrations: sdk.getDefaultIntegrations,
  getClient: () => sdk.client,
  addBreadcrumb: sdk.addBreadcrumb,
  withScope: (callback: (scope: unknown) => unknown) => callback(sdk.scope),
  captureException: sdk.captureException,
  captureMessage: sdk.captureMessage,
  IPCMode: { Classic: 1 },
}) as never);
vi.mock(import('../app/settings'), () => ({ getUsageAnalyticsConsent: vi.fn(), getErrorReportCaps: vi.fn(), setErrorReportCaps: vi.fn() }));
vi.mock(import('./config'), () => ({ getSentryEndpoint: vi.fn() }));
vi.mock(import('./routing'), () => ({ startErrorRouting: vi.fn() }));
vi.mock(import('../app/startup-state'), () => ({ isStartingUp: vi.fn(() => false) }));
vi.mock(import('../logging/logger'), () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() } }));

const stopRouting = vi.fn();
const enabled = { name: 'ENABLED', dsn: 'https://key@o1.ingest.de.sentry.io/2' } as const;

// The SDK starts once per process, so each test loads a fresh copy of the module.
let observability: typeof import('./sentry');
let routing: typeof import('./routing');
let settings: typeof import('../app/settings');
let config: typeof import('./config');
let incidents: typeof import('./incidents');

const { startObservability, stopObservability, isObservabilityActive, getScrubber, keepIntegrations, clearObservabilityData } = {
  startObservability: () => observability.startObservability(),
  stopObservability: () => observability.stopObservability(),
  isObservabilityActive: () => observability.isObservabilityActive(),
  getScrubber: () => observability.getScrubber(),
  keepIntegrations: <T extends { name: string }>(integrations: T[]) => observability.keepIntegrations(integrations),
  clearObservabilityData: () => observability.clearObservabilityData(),
};

function lastSink(): ReportSink {
  const call = vi.mocked(routing.startErrorRouting).mock.calls.at(-1);
  if (!call) {
    throw new Error('Routing did not start.');
  }
  return call[0].sink;
}

beforeEach(async () => {
  vi.resetModules();
  observability = await import('./sentry');
  routing = await import('./routing');
  settings = await import('../app/settings');
  config = await import('./config');
  incidents = await import('./incidents');
  vi.mocked(settings.getUsageAnalyticsConsent).mockResolvedValue('granted');
  vi.mocked(config.getSentryEndpoint).mockReturnValue(enabled);
  vi.mocked(routing.startErrorRouting).mockReturnValue(stopRouting);
  sdk.client.options.enabled = true;
});

afterEach(async () => {
  await stopObservability();
  vi.mocked(rm).mockClear();
});

describe('startObservability', () => {
  test.each([['denied' as const], ['unset' as const]])('never loads the SDK for a user whose choice is %s', async (consent) => {
    // Arrange
    vi.mocked(settings.getUsageAnalyticsConsent).mockResolvedValue(consent);

    // Act
    await startObservability();

    // Assert
    expect(sdk.init).not.toHaveBeenCalled();
    expect(routing.startErrorRouting).not.toHaveBeenCalled();
    expect(isObservabilityActive()).toBe(false);
  });

  test('never loads the SDK in a build without a DSN, whatever the choice', async () => {
    // Arrange
    vi.mocked(config.getSentryEndpoint).mockReturnValue({ name: 'DISABLED', reason: 'NO_DSN' });

    // Act
    await startObservability();

    // Assert
    expect(sdk.init).not.toHaveBeenCalled();
    expect(isObservabilityActive()).toBe(false);
  });

  test('deletes what an earlier agreement left on disk when it does not start', async () => {
    // Arrange
    vi.mocked(settings.getUsageAnalyticsConsent).mockResolvedValue('denied');

    // Act
    await startObservability();

    // Assert
    expect(vi.mocked(rm).mock.calls.map(([target]) => target)).toEqual([
      path.join(userData, 'sentry'),
      path.join(crashDumps, 'pending'),
      path.join(crashDumps, 'new'),
      path.join(crashDumps, 'completed'),
      path.join(crashDumps, 'attachments'),
    ]);
  });

  test('starts the SDK with the allowlist options when the user agreed', async () => {
    // Act
    await startObservability();

    // Assert
    expect(sdk.init).toHaveBeenCalledOnce();
    const options = sdk.init.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options).toMatchObject({
      dsn: enabled.dsn,
      release: 'monfil@1.2.3',
      environment: 'github',
      tracesSampleRate: 0,
      ipcMode: 1,
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    });
    expect(options).not.toHaveProperty('integrations');
    expect((options['defaultIntegrations'] as { name: string }[]).map((integration) => integration.name)).toEqual(['SentryMinidump', 'MainProcessSession', 'Context', 'NormalizePaths']);
    expect(routing.startErrorRouting).toHaveBeenCalledOnce();
    expect(isObservabilityActive()).toBe(true);
    expect(getScrubber()).toBeDefined();
  });

  test('tells the routing when the app is quitting', async () => {
    // Arrange
    const { markShuttingDown } = await import('../app/shutdown-state');
    await startObservability();
    const options = vi.mocked(routing.startErrorRouting).mock.calls.at(-1)?.[0];

    // Act
    const before = options?.isShuttingDown();
    markShuttingDown();

    // Assert
    expect(before).toBe(false);
    expect(options?.isShuttingDown()).toBe(true);
  });

  test('scrubs events and breadcrumbs before they leave', async () => {
    // Act
    await startObservability();
    const options = sdk.init.mock.calls[0]?.[0] as { beforeSend: (event: Record<string, unknown>) => Record<string, unknown>; beforeBreadcrumb: (crumb: Record<string, unknown>) => unknown };
    const sent = options.beforeSend({ message: 'fail at https://x.test', user: { email: 'a@b.test' }, request: { url: 'https://x.test' } });
    const dropped = options.beforeBreadcrumb({ category: 'console', message: 'x' });

    // Assert
    expect(sent).toEqual({ message: 'fail at [url]', contexts: {} });
    expect(dropped).toBeNull();
  });

  test('makes the allowlist final for an event that skipped beforeSend, such as feedback', async () => {
    // Arrange
    await startObservability();
    const event: Record<string, unknown> = { type: 'feedback', contexts: { trace: { trace_id: 't' }, feedback: { message: 'hello', contact_email: 'a@b.test' } }, user: { email: 'a@b.test' } };

    // Act
    sdk.hooks['beforeSendEvent']?.(event);

    // Assert
    expect(event).toEqual({ type: 'feedback', contexts: { feedback: { message: 'hello' } } });
  });

  test('drops what the hooks see after the user withdrew', async () => {
    // Arrange
    await startObservability();
    const options = sdk.init.mock.calls[0]?.[0] as { beforeSend: (event: Record<string, unknown>) => unknown; beforeBreadcrumb: (crumb: Record<string, unknown>) => unknown };
    await stopObservability();
    const late: Record<string, unknown> = { message: 'late' };

    // Act
    sdk.hooks['beforeSendEvent']?.(late);

    // Assert
    expect(options.beforeSend({ message: 'late' })).toBeNull();
    expect(options.beforeBreadcrumb({ category: 'monfil.log' })).toBeNull();
    expect(late).toEqual({});
  });

  test('does not start twice', async () => {
    // Act
    await startObservability();
    await startObservability();

    // Assert
    expect(sdk.init).toHaveBeenCalledOnce();
  });

  test('starts again after it stopped without loading the SDK a second time', async () => {
    // Act
    await startObservability();
    await stopObservability();
    expect(sdk.client.options.enabled).toBe(false);
    await startObservability();

    // Assert
    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.client.options.enabled).toBe(true);
    expect(routing.startErrorRouting).toHaveBeenCalledTimes(2);
    expect(isObservabilityActive()).toBe(true);
  });
});

describe('stopObservability', () => {
  test('stops the routing, turns the client off, and deletes what is stored', async () => {
    // Arrange
    await startObservability();
    vi.mocked(rm).mockClear();

    // Act
    await stopObservability();

    // Assert
    expect(stopRouting).toHaveBeenCalledOnce();
    expect(sdk.client.options.enabled).toBe(false);
    expect(vi.mocked(rm)).toHaveBeenCalledWith(path.join(userData, 'sentry'), { recursive: true, force: true });
    expect(isObservabilityActive()).toBe(false);
    expect(getScrubber()).toBeUndefined();
  });

  test('forgets the reports that were sent', async () => {
    // Arrange
    await startObservability();
    incidents.rememberReportedEvent('abcd1234', 'event-1');

    // Act
    await stopObservability();

    // Assert
    expect(incidents.findReportedEvent('abcd1234')).toBeUndefined();
  });

  test('only deletes the stored data when the SDK never started', async () => {
    // Arrange
    sdk.client.options.enabled = true;

    // Act
    await stopObservability();

    // Assert
    expect(sdk.client.options.enabled).toBe(true);
    expect(rm).toHaveBeenCalled();
  });

  test('does not fail when a folder cannot be deleted', async () => {
    // Arrange
    vi.mocked(rm).mockRejectedValue(new Error('busy'));

    // Act, Assert
    await expect(clearObservabilityData()).resolves.toBeUndefined();
  });
});

describe('the sink', () => {
  beforeEach(async () => {
    await startObservability();
  });

  test('adds a log breadcrumb with its level', () => {
    // Act
    lastSink().breadcrumb({ event: 'app.update', level: 'warn', data: { outcome: 'failed' } });
    lastSink().breadcrumb({ event: 'app.lifecycle', level: 'info', data: {} });

    // Assert
    expect(sdk.addBreadcrumb).toHaveBeenNthCalledWith(1, { category: 'monfil.log', message: 'app.update', level: 'warning', data: { outcome: 'failed' } });
    expect(sdk.addBreadcrumb).toHaveBeenNthCalledWith(2, { category: 'monfil.log', message: 'app.lifecycle', level: 'info', data: {} });
  });

  test('captures an error with its tags and the mechanism that says if it was handled', () => {
    // Arrange
    const error = new Error('boom');

    // Act
    const eventId = lastSink().capture({ error, message: 'system.failure', level: 'error', tags: { source: 'x' }, handled: false });

    // Assert
    expect(eventId).toBe('event-exception');
    expect(sdk.scope.setTags).toHaveBeenCalledWith({ source: 'x' });
    expect(sdk.scope.setLevel).toHaveBeenCalledWith('error');
    expect(sdk.captureException).toHaveBeenCalledWith(error, { mechanism: { type: 'monfil.log', handled: false } });
  });

  test('captures a handled failure that has no error as a message with a fingerprint', () => {
    // Act
    const eventId = lastSink().capture({ error: undefined, message: 'database.recovery', level: 'warning', tags: {}, handled: true, fingerprint: ['database.recovery', 'reset'] });

    // Assert
    expect(eventId).toBe('event-message');
    expect(sdk.scope.setFingerprint).toHaveBeenCalledWith(['database.recovery', 'reset']);
    expect(sdk.captureMessage).toHaveBeenCalledWith('database.recovery', 'warning');
  });

  test('captures an unhandled failure that has no error as a made-up error, so the session counts as crashed', () => {
    // Act
    lastSink().capture({ error: undefined, message: 'system.failure', level: 'error', tags: {}, handled: false, fingerprint: ['system.failure'] });

    // Assert
    expect(sdk.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'system.failure' }), { mechanism: { type: 'monfil.log', handled: false } });
  });
});

describe('keepIntegrations', () => {
  test('keeps the allowlisted names and drops the rest', () => {
    // Act
    const kept = keepIntegrations([{ name: 'SentryMinidump' }, { name: 'ElectronBreadcrumbs' }, { name: 'Screenshots' }, { name: 'LinkedErrors' }]);

    // Assert
    expect(kept).toEqual([{ name: 'SentryMinidump' }, { name: 'LinkedErrors' }]);
  });
});

describe('resolveEnvironment', () => {
  test.each([
    [{ windowsStore: true }, 'store'],
    [{ mas: true }, 'store'],
    [{}, 'github'],
    [{ windowsStore: false, mas: false }, 'github'],
  ])('maps %j to %s', (runtime, environment) => {
    // Act, Assert
    expect(resolveEnvironment(runtime)).toBe(environment);
  });
});
