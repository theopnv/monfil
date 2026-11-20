// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { FeedItem } from '../db/types';
import { runWithConcurrency } from '../lib/utils';
import { fetchText } from '../lib/fetch';
import { extractOgImageUrl } from './extractOgImage';
import { ENRICHMENT_CONCURRENCY, ARTICLE_FETCH_TIMEOUT_MS } from '../lib/constants';
import { hasHttpScheme } from '../../shared/url';

interface Candidate<T> {
  item: T;
  link: string;
  host: string;
}

function hostFor(link: string): string {
  try {
    return new URL(link).host;
  } catch {
    return link;
  }
}

type EnrichableItem = Pick<FeedItem, 'id' | 'link' | 'image'>;

function toCandidates<T extends EnrichableItem>(items: readonly T[]): Candidate<T>[] {
  const candidates: Candidate<T>[] = [];
  for (const item of items) {
    if (!item.link || !hasHttpScheme(item.link)) {
      continue;
    }
    // better-sqlite3 reads a NULL column back as `null`, not `undefined`, despite the FeedItem type.
    if (item.image) {
      continue;
    }
    candidates.push({ item, link: item.link, host: hostFor(item.link) });
  }
  return candidates;
}

/**
 * Fetches pages for items without an image and reports the first image found in their metadata.
 * Only items with an absolute http(s) link to a public host are fetched.
 */
export async function enrichItems<T extends EnrichableItem>(
  items: readonly T[],
  onImageFound: (item: T, image: string) => void,
): Promise<void> {
  const previousByHost = new Map<string, Promise<void>>();
  await runWithConcurrency(toCandidates(items), ENRICHMENT_CONCURRENCY, async (candidate) => {
    const previous = previousByHost.get(candidate.host) ?? Promise.resolve();
    const current = previous.then(async () => {
      const result = await fetchText(candidate.link, { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true, stopAfter: '</head>' });
      if (!result.success) {
        return;
      }
      const image = extractOgImageUrl(result.data.body);
      if (image) {
        onImageFound(candidate.item, image);
      }
    });
    previousByHost.set(candidate.host, current);
    await current;
  });
}
