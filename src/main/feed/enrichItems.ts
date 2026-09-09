import type { FeedItem, NewArticleContent } from '../db/types';
import { runWithConcurrency } from '../lib/utils';
import { fetchUrl } from '../lib/fetch';
import { deriveArticleContentStatus, extractArticle } from './extractArticle';
import { extractOgImageUrl } from './extractOgImage';
import { ENRICHMENT_CONCURRENCY, ARTICLE_FETCH_TIMEOUT_MS } from '../constants';

const ABSOLUTE_HTTP_URL_REGEX = /^https?:\/\//i;

interface Candidate {
  id: number;
  link: string;
  hasImage: boolean;
}

function toCandidates(items: readonly Pick<FeedItem, 'id' | 'link' | 'image'>[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const item of items) {
    if (!item.link || !ABSOLUTE_HTTP_URL_REGEX.test(item.link)) {
      continue;
    }
    // better-sqlite3 reads a NULL column back as `null`, not `undefined`, despite the FeedItem type.
    candidates.push({ id: item.id, link: item.link, hasImage: !!item.image });
  }
  return candidates;
}

export type NewArticleContentPayload = Omit<NewArticleContent, 'item_id'>;

/**
 * Fetches each candidate item's page once, and feeds that one fetch to both extractors: the
 * og:image (skipped when the item already has an image) and the article body.
 * @param items the items to consider; only those with an absolute http(s) link are fetched
 * @param onImageFound called for each item whose page yields an og:image / twitter:image
 * @param onContentFound called for every fetched item with its extraction outcome, success or not
 */
export async function enrichItems(
  items: readonly Pick<FeedItem, 'id' | 'link' | 'image'>[],
  onImageFound: (itemId: number, image: string) => void,
  onContentFound: (itemId: number, content: NewArticleContentPayload) => void,
): Promise<void> {
  await runWithConcurrency(toCandidates(items), ENRICHMENT_CONCURRENCY, async (candidate) => {
    const result = await fetchUrl(candidate.link, { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS });
    if (!result.success) {
      return;
    }
    const html = result.data;

    if (!candidate.hasImage) {
      const image = extractOgImageUrl(html);
      if (image) {
        onImageFound(candidate.id, image);
      }
    }

    const article = extractArticle(html, candidate.link);
    onContentFound(candidate.id, {
      html: article?.html,
      text: article?.text,
      word_count: article?.wordCount,
      status: deriveArticleContentStatus(article),
    });
  });
}
