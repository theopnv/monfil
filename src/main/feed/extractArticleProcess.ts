import { extractArticle } from './extractArticle';
import { isExtractArticleRequest, type ExtractArticleLog, type ExtractArticleResponse } from './extractArticleProtocol';

process.parentPort.on('message', (event) => {
  if (!isExtractArticleRequest(event.data)) {
    return;
  }

  const { id, html, url } = event.data;
  let article;
  try {
    article = extractArticle(html, url);
  } catch (error) {
    const record: ExtractArticleLog = { type: 'log', message: error instanceof Error ? error.message : String(error) };
    process.parentPort.postMessage(record);
  }
  const response: ExtractArticleResponse = { id, article };
  process.parentPort.postMessage(response);
});
