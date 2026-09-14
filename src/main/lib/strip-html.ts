import { decode, EntityLevel } from 'entities';

// <style>/<script> content never renders as text; Blogger/Blogspot feeds in particular embed a
// <style> block ahead of the article body, which would otherwise leak into the stripped output.
const STYLE_SCRIPT_REGEX = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG_REGEX = /<[^>]*>/g;

function stripToFixedPoint(input: string, pattern: RegExp): string {
  let previous: string;
  let current = input;
  do {
    previous = current;
    current = current.replace(pattern, '');
  } while (current !== previous);
  return current;
}

/** Strips an HTML fragment down to its plain-text content, decoding entities and collapsing whitespace. */
export function stripHtml(html: string): string {
  // Entities must be decoded before tag stripping: decoding afterwards would turn
  // entity-encoded markup (e.g. `&lt;script&gt;`) into live tags that already skipped removal.
  const decoded = decode(html, EntityLevel.HTML);
  const withoutStyleScript = stripToFixedPoint(decoded, STYLE_SCRIPT_REGEX);
  const withoutTags = stripToFixedPoint(withoutStyleScript, TAG_REGEX);
  // An unterminated tag (no closing `>`) never matches TAG_REGEX, so any leftover `<` is dropped directly.
  const withoutStrayBrackets = withoutTags.replace(/</g, '');
  return withoutStrayBrackets.replace(/\s+/g, ' ').trim();
}

/** Truncates plain text to at most `maxLength` characters, breaking on a word boundary and appending an ellipsis. */
export function truncateOnWordBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const truncated = trimmed.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const boundary = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${boundary.trimEnd()}…`;
}
