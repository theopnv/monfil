// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export const EVENTS_PATH = '/api/v0/events';

const REGION_HOSTS: Record<string, string> = {
  EU: 'https://eu.aptabase.com',
  US: 'https://us.aptabase.com',
};

export interface AnalyticsConfig {
  key: string | undefined;
  host: string | undefined;
  isPackaged: boolean;
  isE2E: boolean;
  /** A local stub for end-to-end tests. It only counts in an end-to-end run. */
  override: string | undefined;
}

export type AnalyticsEndpoint =
  | { name: 'ENABLED'; url: string; key: string }
  | { name: 'DISABLED'; reason: 'NO_KEY' | 'INVALID_KEY' | 'MISSING_HOST' | 'INVALID_HOST' | 'DEVELOPMENT' | 'E2E' };

function selfHostedUrl(host: string | undefined): string | undefined {
  if (!host) {
    return undefined;
  }
  try {
    const parsed = new URL(host);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? `${parsed.origin}${EVENTS_PATH}` : undefined;
  } catch {
    return undefined;
  }
}

function resolveKeyedEndpoint(key: string, host: string | undefined): AnalyticsEndpoint {
  const region = /^A-([A-Z]{2})-\d+$/.exec(key)?.[1];
  if (region === 'SH') {
    if (!host) {
      return { name: 'DISABLED', reason: 'MISSING_HOST' };
    }
    const url = selfHostedUrl(host);
    return url ? { name: 'ENABLED', url, key } : { name: 'DISABLED', reason: 'INVALID_HOST' };
  }
  const regionHost = region ? REGION_HOSTS[region] : undefined;
  return regionHost ? { name: 'ENABLED', url: `${regionHost}${EVENTS_PATH}`, key } : { name: 'DISABLED', reason: 'INVALID_KEY' };
}

/**
 * Picks where usage events go. A paid plan uses the same key. A self-hosted server uses an `A-SH-` key and a host.
 * @param config the build-time key and host, plus the runtime environment
 * @returns the events URL and key, or the reason nothing is sent
 */
export function resolveAnalyticsEndpoint(config: AnalyticsConfig): AnalyticsEndpoint {
  if (config.isE2E) {
    return config.override
      ? { name: 'ENABLED', url: config.override, key: config.key || 'A-SH-E2E' }
      : { name: 'DISABLED', reason: 'E2E' };
  }
  if (!config.isPackaged) {
    return { name: 'DISABLED', reason: 'DEVELOPMENT' };
  }
  return config.key ? resolveKeyedEndpoint(config.key, config.host) : { name: 'DISABLED', reason: 'NO_KEY' };
}
