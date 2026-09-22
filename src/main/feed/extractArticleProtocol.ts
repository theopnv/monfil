import type { ExtractedArticle } from './extractArticle';

export interface ExtractArticleRequest {
  id: number;
  html: string;
  url: string;
}

export interface ExtractArticleResponse {
  id: number;
  article: ExtractedArticle | undefined;
}

export function isExtractArticleRequest(value: unknown): value is ExtractArticleRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const request = value as Partial<ExtractArticleRequest>;
  return typeof request.id === 'number' && typeof request.html === 'string' && typeof request.url === 'string';
}

export function isExtractArticleResponse(value: unknown): value is ExtractArticleResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Partial<ExtractArticleResponse>;
  return typeof response.id === 'number'
    && (response.article === undefined || (typeof response.article.html === 'string'
      && typeof response.article.text === 'string'
      && typeof response.article.wordCount === 'number'));
}
