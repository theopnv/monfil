import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import type { ArticleContentStatus } from '../db/types';
import { SANITIZE_CONFIG } from '../lib/sanitize-html';
import { MIN_ARTICLE_LENGTH } from '../constants';

export interface ExtractedArticle {
  html: string;
  text: string;
  wordCount: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Runs Readability over a fetched page and sanitizes the result.
 * @param pageHtml the raw HTML of the article page
 * @param url the page's URL, used to resolve relative links and image sources in the extracted markup
 * @returns the extracted article, or `undefined` when Readability finds no content
 */
export function extractArticle(pageHtml: string, url: string): ExtractedArticle | undefined {
  // `url` sets `document.baseURI`/`documentURI`, which is what Readability resolves relative
  // links and image sources against. Scripts and external resources are never fetched or run:
  // jsdom's `runScripts`/`resources` options are left at their safe (disabled) defaults.
  const dom = new JSDOM(pageHtml, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article?.content || !article.textContent?.trim()) {
    return undefined;
  }

  const purify = createDOMPurify(dom.window);
  const html = purify.sanitize(article.content, SANITIZE_CONFIG);
  const text = article.textContent.trim();

  return { html, text, wordCount: countWords(text) };
}

export function deriveArticleContentStatus(article: ExtractedArticle | undefined): ArticleContentStatus {
  if (!article) {
    return 'failed';
  }
  return article.text.length < MIN_ARTICLE_LENGTH ? 'too_short' : 'ok';
}
