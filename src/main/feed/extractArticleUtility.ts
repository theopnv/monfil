// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { utilityProcess } from 'electron';
import path from 'node:path';
import type { UtilityProcess } from 'electron';
import type { ExtractedArticle } from './extractArticle';
import { ARTICLE_EXTRACTION_SERVICE_NAME, isExtractArticleLog, isExtractArticleResponse, type ExtractArticleRequest } from './extractArticleProtocol';
import { logger } from '../logging/logger';

export const EXTRACTION_TIMEOUT_MS = 20_000;

interface PendingExtraction {
  request: ExtractArticleRequest;
  resolve: (article: ExtractedArticle | undefined) => void;
  reject: (error: Error) => void;
}

let extractionProcess: UtilityProcess | undefined;
let nextRequestId = 0;
let frontTimer: NodeJS.Timeout | undefined;
const pending = new Map<number, PendingExtraction>();

function rejectPending(error: Error): void {
  clearTimeout(frontTimer);
  for (const request of pending.values()) {
    request.reject(error);
  }
  pending.clear();
}

// The process answers in order, so only the request at the front is running. The others wait without a clock.
function watchFrontRequest(): void {
  clearTimeout(frontTimer);
  const [front] = pending.keys();
  if (front !== undefined) {
    frontTimer = setTimeout(() => abandonRequest(front), EXTRACTION_TIMEOUT_MS);
  }
}

function abandonRequest(id: number): void {
  const request = pending.get(id);
  if (!request) {
    return;
  }
  pending.delete(id);
  request.reject(new Error(`Article extraction timed out after ${EXTRACTION_TIMEOUT_MS} ms.`));
  const stuck = extractionProcess;
  extractionProcess = undefined;
  stuck?.kill();
  if (pending.size > 0) {
    const child = startExtractionProcess();
    for (const waiting of pending.values()) {
      child.postMessage(waiting.request);
    }
    watchFrontRequest();
  }
}

function startExtractionProcess(): UtilityProcess {
  const child = utilityProcess.fork(path.join(__dirname, 'extractArticleProcess.cjs'), [], { serviceName: ARTICLE_EXTRACTION_SERVICE_NAME });
  extractionProcess = child;
  child.on('message', (message: unknown) => {
    if (isExtractArticleLog(message)) {
      logger.error('operation.failure', { operation: 'extract-article-utility' }, message.message);
      return;
    }
    if (!isExtractArticleResponse(message)) {
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    pending.delete(message.id);
    watchFrontRequest();
    request.resolve(message.article);
  });
  child.on('exit', (code) => {
    if (extractionProcess !== child) {
      return;
    }
    extractionProcess = undefined;
    rejectPending(new Error(`Article extraction utility process exited with code ${code}.`));
  });
  return child;
}

export function extractArticleInUtilityProcess(html: string, url: string): Promise<ExtractedArticle | undefined> {
  const child = extractionProcess ?? startExtractionProcess();
  const id = nextRequestId;
  nextRequestId += 1;
  const request: ExtractArticleRequest = { id, html, url };
  return new Promise((resolve, reject) => {
    pending.set(id, { request, resolve, reject });
    if (pending.size === 1) {
      watchFrontRequest();
    }
    child.postMessage(request);
  });
}

export function stopArticleExtractionProcess(): void {
  extractionProcess?.kill();
  extractionProcess = undefined;
  rejectPending(new Error('Article extraction utility process stopped.'));
}
