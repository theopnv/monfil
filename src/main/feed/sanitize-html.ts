// Shared with src/renderer/lib/sanitize-html.ts: main sanitizes extracted article HTML before
// storing it, and the renderer sanitizes again at render time. Both must allow the same markup.
export const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'img', 'figure', 'figcaption', 'span',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'sup', 'sub', 'picture', 'source',
];
export const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'srcset', 'width', 'height'];

export const SANITIZE_CONFIG = { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false };
