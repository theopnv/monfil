import { fetchUrl } from '../fetch';
import { extractOgImageUrl } from './extractOgImage';

export const ARTICLE_FETCH_TIMEOUT_MS = 5000;

export async function fetchArticleImage(link: string): Promise<string | undefined> {
  const result = await fetchUrl(link, AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS));
  if (!result.success) return undefined;
  return extractOgImageUrl(result.data);
}
