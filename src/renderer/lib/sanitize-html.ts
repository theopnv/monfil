import DOMPurify from 'dompurify';
import { SANITIZE_CONFIG } from '../../main/lib/sanitize-html';

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
