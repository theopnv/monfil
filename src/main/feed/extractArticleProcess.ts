import { extractArticle } from './extractArticle';
import { isExtractArticleRequest, type ExtractArticleResponse } from './extractArticleProtocol';

process.parentPort.on('message', (event) => {
  if (!isExtractArticleRequest(event.data)) {
    return;
  }

  const { id, html, url } = event.data;
  let article;
  try {
    article = extractArticle(html, url);
  } catch (error) {
    console.error(`Failed to extract article content for ${url}.`, error);
  }
  const response: ExtractArticleResponse = { id, article };
  process.parentPort.postMessage(response);
});
