/**
 * The icon to show for a feed: its own stored icon (a YouTube channel avatar, for instance),
 * falling back to the site favicon RSS feeds don't carry one for.
 * @param icon the feed's stored `icon` column
 * @param link the feed's link, used for the favicon fallback
 */
export function resolveFeedIcon(icon: string | undefined, link: string): string | undefined {
  return icon ?? getFaviconUrl(link);
}

export function getFaviconUrl(link: string | undefined): string | undefined {
  if (!link) {
    return undefined;
  }
  try {
    const url = new URL(link);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    if (url.hostname.split('.').length > 2) {
      const domainParts = url.hostname.split('.');
      const rootDomain = domainParts.slice(-2).join('.');
      return `${url.protocol}//${rootDomain}/favicon.ico`;
    }
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}
