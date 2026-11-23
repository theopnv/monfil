// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { parseHttpUrl } from '../../shared/url';

export interface SentryConfig {
  dsn: string | undefined;
  isPackaged: boolean;
  isE2E: boolean;
  /** A local stub for end-to-end tests. It only counts in an end-to-end run. */
  override: string | undefined;
}

export type SentryEndpoint =
  | { name: 'ENABLED'; dsn: string }
  | { name: 'DISABLED'; reason: 'NO_DSN' | 'INVALID_DSN' | 'DEVELOPMENT' | 'E2E' };

function isValidDsn(dsn: string, allowPlainHttp: boolean): boolean {
  const url = parseHttpUrl(dsn);
  if (!url || !url.username || !/^\/(?:[^/]+\/)*\d+$/.test(url.pathname)) {
    return false;
  }
  return allowPlainHttp || url.protocol === 'https:';
}

/** Picks where error reports go. A development build, an end-to-end run without a stub, and a build with no DSN send nothing. */
export function resolveSentryEndpoint(config: SentryConfig): SentryEndpoint {
  if (config.isE2E) {
    return config.override && isValidDsn(config.override, true)
      ? { name: 'ENABLED', dsn: config.override }
      : { name: 'DISABLED', reason: 'E2E' };
  }
  if (!config.isPackaged) {
    return { name: 'DISABLED', reason: 'DEVELOPMENT' };
  }
  if (!config.dsn) {
    return { name: 'DISABLED', reason: 'NO_DSN' };
  }
  return isValidDsn(config.dsn, false) ? { name: 'ENABLED', dsn: config.dsn } : { name: 'DISABLED', reason: 'INVALID_DSN' };
}
