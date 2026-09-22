import { utilityProcess } from 'electron';
import path from 'node:path';
import type { UtilityProcess } from 'electron';
import type { ExtractedArticle } from './extractArticle';
import { isExtractArticleLog, isExtractArticleResponse, type ExtractArticleRequest } from './extractArticleProtocol';
import { logger } from '../logging/logger';

interface PendingExtraction {
  resolve: (article: ExtractedArticle | undefined) => void;
  reject: (error: Error) => void;
}

let extractionProcess: UtilityProcess | undefined;
let nextRequestId = 0;
const pending = new Map<number, PendingExtraction>();

function rejectPending(error: Error): void {
  for (const request of pending.values()) {
    request.reject(error);
  }
  pending.clear();
}

function startExtractionProcess(): UtilityProcess {
  const child = utilityProcess.fork(path.join(__dirname, 'extractArticleProcess.js'));
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
    pending.set(id, { resolve, reject });
    child.postMessage(request);
  });
}

export function stopArticleExtractionProcess(): void {
  extractionProcess?.kill();
  extractionProcess = undefined;
  rejectPending(new Error('Article extraction utility process stopped.'));
}
