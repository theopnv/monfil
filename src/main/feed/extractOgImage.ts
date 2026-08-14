const META_TAG_REGEX = /<meta\b[^>]*>/gi;
const PROPERTY_OR_NAME_REGEX = /(?:property|name)\s*=\s*["']([^"']+)["']/i;
const CONTENT_REGEX = /content\s*=\s*["']([^"']*)["']/i;

function findMetaContent(html: string, target: string): string | undefined {
  const tags = html.match(META_TAG_REGEX);
  if (!tags) return undefined;

  for (const tag of tags) {
    if (PROPERTY_OR_NAME_REGEX.exec(tag)?.[1]?.toLowerCase() !== target) continue;
    const content = CONTENT_REGEX.exec(tag)?.[1];
    if (content) return content;
  }

  return undefined;
}

export function extractOgImageUrl(html: string): string | undefined {
  return findMetaContent(html, 'og:image') ?? findMetaContent(html, 'twitter:image');
}
