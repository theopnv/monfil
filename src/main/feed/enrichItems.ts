import type { FeedItem } from '../db/types';
import { runWithConcurrency } from '../lib/utils';
import { fetchText } from '../lib/fetch';
import { extractOgImageUrl } from './extractOgImage';
import { ENRICHMENT_CONCURRENCY, ARTICLE_FETCH_TIMEOUT_MS } from '../constants';

const ABSOLUTE_HTTP_URL_REGEX = /^https?:\/\//i;

interface Candidate {
  id: number;
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

function toCandidates(items: readonly Pick<FeedItem, 'id' | 'link' | 'image'>[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const item of items) {
    if (!item.link || !ABSOLUTE_HTTP_URL_REGEX.test(item.link)) {
      continue;
    }
    // better-sqlite3 reads a NULL column back as `null`, not `undefined`, despite the FeedItem type.
    if (item.image) {
      continue;
    }
    candidates.push({ id: item.id, link: item.link, host: hostFor(item.link) });
  }
  return candidates;
}

/**
 * Fetches pages for items without an image and reports the first image found in their metadata.
 * @param items the items to consider; only those with an absolute http(s) link to a public host are fetched
 * @param onImageFound called for each item whose page yields an og:image / twitter:image
 */
export async function enrichItems(
  items: readonly Pick<FeedItem, 'id' | 'link' | 'image'>[],
  onImageFound: (itemId: number, image: string) => void,
): Promise<void> {
  const previousByHost = new Map<string, Promise<void>>();
  await runWithConcurrency(toCandidates(items), ENRICHMENT_CONCURRENCY, async (candidate) => {
    const previous = previousByHost.get(candidate.host) ?? Promise.resolve();
    const current = previous.then(async () => {
      const result = await fetchText(candidate.link, { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true });
      if (!result.success) {
        return;
      }
      const image = extractOgImageUrl(result.data.body);
      if (image) {
        onImageFound(candidate.id, image);
      }
    });
    previousByHost.set(candidate.host, current);
    await current;
  });
}
