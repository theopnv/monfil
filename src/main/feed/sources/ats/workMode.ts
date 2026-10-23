// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { WorkMode } from './types';

const HYBRID = /\b(hybrid|hybride|télétravail partiel|teletravail partiel|partial remote)\b/i;
const REMOTE = /\b(remote|télétravail|teletravail|work from home|fully distributed|à distance)\b/i;
const ON_SITE = /\b(on[- ]?site|sur site|présentiel|presentiel|in[- ]office)\b/i;

/** Reads a work mode out of a provider field value such as "Remote", "OnSite" or "fully". */
export function normalizeWorkMode(value: string | undefined): WorkMode | undefined {
  const text = value?.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (!text) {
    return undefined;
  }
  if (text.startsWith('hybrid')) {
    return 'hybrid';
  }
  if (text === 'remote' || text === 'fully' || text === 'fullyremote' || text === 'telecommuting') {
    return 'remote';
  }
  return text === 'onsite' || text === 'office' || text === 'none' ? 'on-site' : undefined;
}

/**
 * The work mode a job states: the provider's own field when it has one, else a keyword in the texts
 * (location, then title). Hybrid wins over remote because "hybrid remote" is a common phrase.
 */
export function detectWorkMode(providerValue: string | undefined, ...texts: (string | undefined)[]): WorkMode | undefined {
  const fromField = normalizeWorkMode(providerValue);
  if (fromField) {
    return fromField;
  }
  const text = texts.filter((part): part is string => part !== undefined).join(' | ');
  if (HYBRID.test(text)) {
    return 'hybrid';
  }
  if (REMOTE.test(text)) {
    return 'remote';
  }
  return ON_SITE.test(text) ? 'on-site' : undefined;
}
