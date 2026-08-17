import type { FeedItem } from '../db/types';
import { runWithConcurrency } from '../../utils';
import { fetchArticleImage } from './fetchArticleImage';

export const IMAGE_ENRICHMENT_CONCURRENCY = 5;

const ABSOLUTE_HTTP_URL_REGEX = /^https?:\/\//i;

interface Candidate {
  id: number;
  link: string;
}

function toCandidates(items: readonly Pick<FeedItem, 'id' | 'link' | 'image'>[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const item of items) {
    // better-sqlite3 reads a NULL column back as `null`, not `undefined`, despite the FeedItem type.
    if (item.image) continue;
    if (!item.link || !ABSOLUTE_HTTP_URL_REGEX.test(item.link)) continue;
    candidates.push({ id: item.id, link: item.link });
  }
  return candidates;
}

export async function enrichItemImages(
  items: readonly Pick<FeedItem, 'id' | 'link' | 'image'>[],
  onImageFound: (itemId: number, image: string) => void,
): Promise<void> {
  await runWithConcurrency(toCandidates(items), IMAGE_ENRICHMENT_CONCURRENCY, async (candidate) => {
    const image = await fetchArticleImage(candidate.link);
    if (image) onImageFound(candidate.id, image);
  });
}
