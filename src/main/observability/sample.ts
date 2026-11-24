// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import type { Event } from '@sentry/electron/main';
import type { ErrorReportSample } from '../../shared/contracts';
import { createScrubber } from './scrub';
import { resolveEnvironment } from './environment';

/**
 * The report that a made-up failure would produce on this device. The raw event holds a home folder, a link, and
 * an email address, so the user sees what the scrubber removes.
 */
export function sampleErrorEvent(): ErrorReportSample {
  const homeDir = os.homedir();
  const userDataDir = app.getPath('userData');
  const raw: Event = {
    event_id: '00000000000000000000000000000000',
    level: 'error',
    platform: 'node',
    release: `monfil@${app.getVersion()}`,
    environment: resolveEnvironment(process),
    message: 'ipc.failure',
    tags: { logEvent: 'ipc.failure', channel: 'feeds:list', incidentId: '0a1b2c3d', feedTitle: 'Not sent' },
    user: { email: 'name@example.com', ip_address: '203.0.113.7' },
    server_name: os.hostname(),
    request: { url: 'https://example.com/feed.xml' },
    exception: {
      values: [{
        type: 'Error',
        value: `Could not open ${path.join(userDataDir, 'monfil.db')} or https://example.com/feed.xml for name@example.com`,
        mechanism: { type: 'monfil.log', handled: true },
        stacktrace: { frames: [{ filename: 'app:///.vite/build/main.cjs', function: 'dispatch', lineno: 120, colno: 14, in_app: true }] },
      }],
    },
    breadcrumbs: [{ category: 'monfil.log', level: 'info', message: 'app.lifecycle', data: { action: 'window-created', feedId: 4 } }],
  };
  return createScrubber({ homeDir, userDataDir }).event(raw) as ErrorReportSample;
}
