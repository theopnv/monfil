// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

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

export interface ExtractArticleLog {
  type: 'log';
  message: string;
}

export function isExtractArticleRequest(value: unknown): value is ExtractArticleRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const request = value as Partial<ExtractArticleRequest>;
  return typeof request.id === 'number' && typeof request.html === 'string' && typeof request.url === 'string';
}

function isExtractedArticle(value: unknown): value is ExtractedArticle {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const article = value as Partial<ExtractedArticle>;
  return typeof article.html === 'string' && typeof article.text === 'string' && typeof article.wordCount === 'number';
}

export function isExtractArticleResponse(value: unknown): value is ExtractArticleResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Partial<ExtractArticleResponse>;
  return typeof response.id === 'number' && (response.article === undefined || isExtractedArticle(response.article));
}

export function isExtractArticleLog(value: unknown): value is ExtractArticleLog {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<ExtractArticleLog>;
  return record.type === 'log' && typeof record.message === 'string';
}
