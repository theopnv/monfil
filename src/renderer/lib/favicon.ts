/**
 * The icon to show for a feed: its own stored icon (a YouTube channel avatar, for instance),
 * falling back to the site favicon RSS feeds don't carry one for.
 * @param icon the feed's stored `icon` column
 * @param link the feed's link, used for the favicon fallback
 */
export function resolveFeedIcon(icon: string | undefined, link: string): string | undefined {
  return icon ?? getFaviconUrl(link);
}

// Most sites don't serve a favicon at the guessable /favicon.ico path (custom paths, .png
// icons, nested asset dirs), so resolution goes through DuckDuckGo's icon service, which
// crawls the real page for its favicon and re-serves it.
export function getFaviconUrl(link: string | undefined): string | undefined {
  if (!link) {
    return undefined;
  }
  try {
    const url = new URL(link);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return `https://icons.duckduckgo.com/ip3/${url.hostname}.ico`;
  } catch {
    return undefined;
  }
}
