// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import os from 'node:os';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { app } from 'electron';
import type * as SentryApi from '@sentry/electron/main';
import { getUsageAnalyticsConsent } from '../app/settings';
import { isStartingUp } from '../app/startup-state';
import { logger } from '../logging/logger';
import { createCaps } from './caps';
import { getSentryEndpoint } from './config';
import { forgetReportedEvents } from './incidents';
import { startErrorRouting, type ReportSink } from './routing';
import { resolveEnvironment } from './environment';
import { createScrubber, LOG_BREADCRUMB_CATEGORY, type Scrubber } from './scrub';

/** The integrations that stay. The rest add breadcrumbs, screenshots, host details, or a crash dialog that the app does not want. */
const KEPT_INTEGRATIONS: ReadonlySet<string> = new Set([
  'SentryMinidump', 'MainProcessSession', 'EventFilters', 'FunctionToString', 'LinkedErrors', 'ElectronContext', 'NodeContext', 'NormalizePaths',
]);

const CRASH_DUMP_FOLDERS = ['pending', 'new', 'completed', 'attachments'] as const;

export function keepIntegrations<T extends { name: string }>(integrations: T[]): T[] {
  return integrations.filter((integration) => KEPT_INTEGRATIONS.has(integration.name));
}

type Sdk = typeof SentryApi;

/** Loaded on the first start, so a user who never agreed never loads the SDK, and the app starts without its cost. */
let sdk: Sdk | undefined;
let scrubber: Scrubber | undefined;
let stopRouting: (() => void) | undefined;
let initialized = false;
let starting: Promise<void> | undefined;
const caps = createCaps();

export function isObservabilityActive(): boolean {
  return stopRouting !== undefined;
}

/** The SDK, while it runs. */
export function getSdk(): Sdk | undefined {
  return stopRouting === undefined ? undefined : sdk;
}

/** The scrubber of the running SDK. Anything that sends text of its own, such as a log file, must pass it through. */
export function getScrubber(): Scrubber | undefined {
  return scrubber;
}

function levelOf(level: string): SentryApi.SeverityLevel {
  return level === 'warn' ? 'warning' : level === 'debug' ? 'debug' : level === 'error' ? 'error' : 'info';
}

function createSink(Sentry: Sdk): ReportSink {
  return {
    breadcrumb: ({ event, level, data }) => Sentry.addBreadcrumb({ category: LOG_BREADCRUMB_CATEGORY, message: event, level: levelOf(level), data }),
    capture: ({ error, message, level, tags, handled, fingerprint }) => Sentry.withScope((scope) => {
      scope.setTags(tags);
      scope.setLevel(level);
      if (fingerprint) {
        scope.setFingerprint(fingerprint);
      }
      if (!error && handled) {
        return Sentry.captureMessage(message, level);
      }
      return Sentry.captureException(error ?? new Error(message), { mechanism: { type: 'monfil.log', handled } });
    }),
  };
}

async function removeIfAny(target: string): Promise<void> {
  await rm(target, { recursive: true, force: true }).catch(() => undefined);
}

/** Deletes what the SDK keeps on disk: reports that wait for a connection, the session record, and crash dumps that were not sent yet. */
export async function clearObservabilityData(): Promise<void> {
  const crashDumps = app.getPath('crashDumps');
  await Promise.all([
    removeIfAny(path.join(app.getPath('userData'), 'sentry')),
    ...CRASH_DUMP_FOLDERS.map((folder) => removeIfAny(path.join(crashDumps, folder))),
  ]);
  forgetReportedEvents();
}

function initializeSdk(Sentry: Sdk, dsn: string): void {
  Sentry.init({
    dsn,
    release: `monfil@${app.getVersion()}`,
    environment: resolveEnvironment(process),
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    ipcMode: Sentry.IPCMode.Classic,
    defaultIntegrations: keepIntegrations(Sentry.getDefaultIntegrations({})),
    beforeSend: (event) => scrubber?.event(event) ?? null,
    beforeBreadcrumb: (breadcrumb) => scrubber?.breadcrumb(breadcrumb) ?? null,
  });
  // Feedback events skip `beforeSend`, so the last hook before the envelope is built makes the allowlist final for every event.
  Sentry.getClient()?.on('beforeSendEvent', (event) => {
    const scrubbed = scrubber?.event(event) ?? {};
    for (const key of Object.keys(event)) {
      Reflect.deleteProperty(event, key);
    }
    Object.assign(event, scrubbed);
  });
}

/**
 * Starts the error tracker when the user agreed and this build has a DSN. Without both, the SDK never loads,
 * so nothing can be sent. Data that an earlier agreement left on disk goes away.
 */
export function startObservability(): Promise<void> {
  starting ??= initialize().finally(() => {
    starting = undefined;
  });
  return starting;
}

async function initialize(): Promise<void> {
  if (isObservabilityActive()) {
    return;
  }
  const endpoint = getSentryEndpoint();
  if (await getUsageAnalyticsConsent() !== 'granted' || endpoint.name !== 'ENABLED') {
    await clearObservabilityData();
    return;
  }
  scrubber = createScrubber({ homeDir: os.homedir(), userDataDir: app.getPath('userData') });
  const Sentry = await import('@sentry/electron/main');
  sdk = Sentry;
  if (initialized) {
    // A second `init` throws because the SDK registers its IPC handlers once per process.
    const client = Sentry.getClient();
    if (client) {
      client.getOptions().enabled = true;
    }
  } else {
    initializeSdk(Sentry, endpoint.dsn);
    initialized = true;
  }
  stopRouting = startErrorRouting({ sink: createSink(Sentry), caps, isStartingUp });
  logger.info('app.lifecycle', { action: 'error-reports-on' });
}

/** Stops sending at once and deletes what is stored. The user may have turned the setting off. */
export async function stopObservability(): Promise<void> {
  await starting;
  const wasActive = isObservabilityActive();
  stopRouting?.();
  stopRouting = undefined;
  scrubber = undefined;
  const client = wasActive ? sdk?.getClient() : undefined;
  if (client) {
    client.getOptions().enabled = false;
  }
  await clearObservabilityData();
}
