// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { app } from 'electron';
import { resolveAnalyticsEndpoint, type AnalyticsEndpoint } from './endpoint';

/** The endpoint for this build, or the reason there is none. */
export function getAnalyticsEndpoint(): AnalyticsEndpoint {
  return resolveAnalyticsEndpoint({
    key: import.meta.env.MONFIL_APTABASE_KEY,
    host: import.meta.env.MONFIL_APTABASE_HOST,
    isPackaged: app.isPackaged,
    isE2E: process.env['E2E_TEST'] === '1',
    override: process.env['MONFIL_ANALYTICS_ENDPOINT'],
  });
}
