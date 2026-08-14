import type { FeedItem } from '../db/types';
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
  const candidates = toCandidates(items);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < candidates.length) {
      const candidate = candidates[nextIndex];
      nextIndex += 1;
      if (!candidate) continue;
      const image = await fetchArticleImage(candidate.link);
      if (image) onImageFound(candidate.id, image);
    }
  }

  const workerCount = Math.min(IMAGE_ENRICHMENT_CONCURRENCY, candidates.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
