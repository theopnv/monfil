// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { app } from 'electron';
import { resolveSentryEndpoint, type SentryEndpoint } from './endpoint';

export function getSentryEndpoint(): SentryEndpoint {
  return resolveSentryEndpoint({
    dsn: import.meta.env.MONFIL_SENTRY_DSN,
    isPackaged: app.isPackaged,
    isE2E: process.env['E2E_TEST'] === '1',
    override: process.env['MONFIL_SENTRY_ENDPOINT'],
  });
}
