import DOMPurify from 'dompurify';
import { SANITIZE_CONFIG } from '../../shared/sanitize-html';

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
