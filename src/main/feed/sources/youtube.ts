import { parseFeed } from 'feedsmith';
import { fetchUrl } from '../../lib/fetch';
import type { Result } from '../../../shared/result';
import { DEFAULT_MAX_FEED_ITEMS } from '../../settings';
import { decodeOptional, decodeText, resolveGuid } from './text';
import type { FeedFetchError, FetchUrlError, ParsedSource } from '../../../shared/contracts';
import type { NewSourceItem, SourceAdapter } from './types';

export type YoutubeTarget =
  | { kind: 'channel'; channelId: string }
  | { kind: 'playlist'; playlistId: string }
  | { kind: 'page'; path: string }
  | { kind: 'video'; videoId: string };

export interface ExtractedChannel {
  channelId: string | undefined;
  icon: string | undefined;
  title: string | undefined;
  description: string | undefined;
}

const ACCEPTED_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);
const CHANNEL_ID_REGEX = /^UC[\w-]{22}$/;
const HANDLE_REGEX = /^@[\w.-]+$/;
const BARE_WORD_REGEX = /^[\w.-]+$/;

function toYoutubeUrl(raw: string): URL | null {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return ACCEPTED_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

function parseYoutubeUrl(url: URL): YoutubeTarget | null {
  const path = url.pathname;

  if (url.hostname.toLowerCase() === 'youtu.be') {
    const videoId = path.slice(1).split('/')[0];
    if (!videoId) {
      return null;
    }
    const list = url.searchParams.get('list');
    return list ? { kind: 'playlist', playlistId: list } : { kind: 'video', videoId };
  }

  if (path === '/feeds/videos.xml') {
    const channelId = url.searchParams.get('channel_id');
    if (channelId) {
      return { kind: 'channel', channelId };
    }
    const playlistId = url.searchParams.get('playlist_id');
    return playlistId ? { kind: 'playlist', playlistId } : null;
  }

  const channelMatch = /^\/channel\/(UC[\w-]{22})/.exec(path);
  if (channelMatch?.[1]) {
    return { kind: 'channel', channelId: channelMatch[1] };
  }

  const handleMatch = /^(\/@[\w.-]+)/.exec(path);
  if (handleMatch?.[1]) {
    return { kind: 'page', path: handleMatch[1] };
  }

  const legacyMatch = /^(\/(?:c|user)\/[\w.-]+)/.exec(path);
  if (legacyMatch?.[1]) {
    return { kind: 'page', path: legacyMatch[1] };
  }

  if (path === '/playlist') {
    const list = url.searchParams.get('list');
    return list ? { kind: 'playlist', playlistId: list } : null;
  }

  if (path === '/watch') {
    const list = url.searchParams.get('list');
    if (list) {
      return { kind: 'playlist', playlistId: list };
    }
    const videoId = url.searchParams.get('v');
    return videoId ? { kind: 'video', videoId } : null;
  }

  return null;
}

/**
 * Resolves anything a user might type or paste into one of the shapes the adapter can fetch.
 * @param raw the text typed in the Add Feed wizard, or a stored feed's link on refresh
 * @param assumeYoutube whether the caller already knows this is meant to be YouTube (the Step 1
 *   toggle), which lets a bare handle typed without its leading `@` resolve too
 */
export function parseYoutubeInput(raw: string, assumeYoutube = false): YoutubeTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (CHANNEL_ID_REGEX.test(trimmed)) {
    return { kind: 'channel', channelId: trimmed };
  }
  if (HANDLE_REGEX.test(trimmed)) {
    return { kind: 'page', path: `/${trimmed}` };
  }

  const url = toYoutubeUrl(trimmed);
  if (url) {
    return parseYoutubeUrl(url);
  }

  if (assumeYoutube && BARE_WORD_REGEX.test(trimmed)) {
    return { kind: 'page', path: `/@${trimmed}` };
  }

  return null;
}

/** Whether `raw` names a YouTube host, the signal `resolveSource` uses to auto-detect the type without the toggle. */
export function isYoutubeLink(raw: string): boolean {
  return toYoutubeUrl(raw.trim()) !== null && parseYoutubeInput(raw) !== null;
}

const CANONICAL_LINK_REGEX = /<link\s+rel="canonical"\s+href="([^"]+)"/;
const CHANNEL_ID_IN_HREF_REGEX = /\/channel\/(UC[\w-]{22})/;
const CHANNEL_ID_JSON_REGEX = /"channelId":"(UC[\w-]{22})"/;
const OG_IMAGE_REGEX = /<meta property="og:image" content="([^"]*)"/;
const OG_TITLE_REGEX = /<meta property="og:title" content="([^"]*)"/;
const OG_DESCRIPTION_REGEX = /<meta property="og:description" content="([^"]*)"/;

/**
 * Reads channel identity out of a fetched YouTube page (a channel page, a handle page or a watch
 * page all carry the same tags). Regexes over the ~1.1 MB page, not a DOM: only four tags matter.
 */
export function extractChannel(html: string): ExtractedChannel {
  const canonicalHref = CANONICAL_LINK_REGEX.exec(html)?.[1];
  const channelIdFromCanonical = canonicalHref ? CHANNEL_ID_IN_HREF_REGEX.exec(canonicalHref)?.[1] : undefined;
  const channelId = channelIdFromCanonical ?? CHANNEL_ID_JSON_REGEX.exec(html)?.[1];
  const rawIcon = OG_IMAGE_REGEX.exec(html)?.[1];

  return {
    channelId,
    // The largest FeedAvatar renders at 46px; ask for a 2x asset and let CSS downscale it.
    icon: rawIcon ? decodeText(rawIcon.replace(/=s\d+-/, '=s176-')) : undefined,
    title: decodeOptional(OG_TITLE_REGEX.exec(html)?.[1]),
    description: decodeOptional(OG_DESCRIPTION_REGEX.exec(html)?.[1]),
  };
}

// Channel feeds truncate their own <yt:channelId> (the "UC" prefix goes missing), so that field
// must never be trusted to identify a channel feed's own owner. Playlist feeds don't have the bug.
function extractPlaylistOwner(feedContent: string): string | undefined {
  const { format, feed } = parseFeed(feedContent, { maxItems: 0 });
  return format === 'atom' ? feed.yt?.channelId : undefined;
}

function channelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function playlistFeedUrl(playlistId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
}

async function fetchChannelPage(channelId: string): Promise<ExtractedChannel | undefined> {
  const result = await fetchUrl(`https://www.youtube.com/channel/${channelId}`);
  return result.success ? extractChannel(result.data) : undefined;
}

function mapFetchError(error: FetchUrlError): FeedFetchError {
  switch (error.name) {
    case 'GENERIC_FETCH_ERROR':
    case 'NETWORK_ERROR':
    case 'NOT_ALLOWED_OR_ABORTED_ERROR':
    case 'RESPONSE_TOO_LARGE_ERROR':
    case 'BLOCKED_URL_ERROR':
      return error;
    default: {
      const exhaustiveCheck: never = error;
      return exhaustiveCheck;
    }
  }
}

interface Resolution {
  channelId: string;
  icon: string | undefined;
  feedLink: string;
  // Set only when the resolution step already fetched the feed body (the playlist path), so the caller does not fetch it twice.
  feedResult: Result<string, FetchUrlError> | undefined;
}

async function resolveTarget(target: YoutubeTarget): Promise<Result<Resolution, FeedFetchError>> {
  switch (target.kind) {
    case 'channel': {
      const page = await fetchChannelPage(target.channelId);
      return { success: true, data: { channelId: target.channelId, icon: page?.icon, feedLink: channelFeedUrl(target.channelId), feedResult: undefined } };
    }
    case 'page': {
      const pageResult = await fetchUrl(`https://www.youtube.com${target.path}`);
      if (!pageResult.success) {
        return { success: false, error: mapFetchError(pageResult.error) };
      }
      const extracted = extractChannel(pageResult.data);
      if (!extracted.channelId) {
        return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find a YouTube channel at that address." } };
      }
      return { success: true, data: { channelId: extracted.channelId, icon: extracted.icon, feedLink: channelFeedUrl(extracted.channelId), feedResult: undefined } };
    }
    case 'video': {
      const pageResult = await fetchUrl(`https://www.youtube.com/watch?v=${target.videoId}`);
      if (!pageResult.success) {
        return { success: false, error: mapFetchError(pageResult.error) };
      }
      const extracted = extractChannel(pageResult.data);
      if (!extracted.channelId) {
        return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find the channel for that video." } };
      }
      const page = await fetchChannelPage(extracted.channelId);
      return { success: true, data: { channelId: extracted.channelId, icon: page?.icon, feedLink: channelFeedUrl(extracted.channelId), feedResult: undefined } };
    }
    case 'playlist': {
      const feedLink = playlistFeedUrl(target.playlistId);
      const feedResult = await fetchUrl(feedLink);
      if (!feedResult.success) {
        return { success: false, error: mapFetchError(feedResult.error) };
      }
      const ownerId = extractPlaylistOwner(feedResult.data);
      if (!ownerId) {
        return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find the channel that owns that playlist." } };
      }
      const page = await fetchChannelPage(ownerId);
      return { success: true, data: { channelId: ownerId, icon: page?.icon, feedLink, feedResult } };
    }
    default: {
      const exhaustiveCheck: never = target;
      return exhaustiveCheck;
    }
  }
}

interface ParsedYoutubeFeedContent {
  title: string;
  description: string;
  items: NewSourceItem[];
}

export function parseFeedContent(content: string, maxItems: number = 0): ParsedYoutubeFeedContent | null {
  const { format, feed } = parseFeed(content, { maxItems });
  if (format !== 'atom') {
    return null;
  }

  return {
    title: decodeText(feed.title?.value ?? ''),
    description: decodeText(feed.subtitle?.value ?? ''),
    items: (feed.entries ?? []).map((entry) => {
      const title = decodeText(entry.title?.value ?? 'No title');
      const pubDate = entry.published ?? entry.updated ?? 'No publication date';
      const link = entry.links?.find((entryLink) => entryLink.rel === 'alternate' || !entryLink.rel)?.href ?? entry.links?.[0]?.href;
      // The description and thumbnails live under media:group, not directly under media:*.
      const group = entry.media?.groups?.[0];
      return {
        title,
        guid: resolveGuid(entry.id, link, title, pubDate),
        link,
        pubDate,
        description: decodeText(group?.description?.value ?? ''),
        image: group?.thumbnails?.[0]?.url,
        author: decodeOptional(entry.authors?.[0]?.name),
        extra: JSON.stringify({
          videoId: entry.yt?.videoId,
          channelId: entry.yt?.channelId,
          views: group?.community?.statistics?.views,
          rating: group?.community?.starRating?.average,
        }),
        read_at: undefined,
      };
    }),
  };
}

async function fetchFeed(link: string, maxItems: number = DEFAULT_MAX_FEED_ITEMS): Promise<Result<ParsedSource, FeedFetchError>> {
  try {
    const target = parseYoutubeInput(link, true);
    if (!target) {
      return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a YouTube channel, playlist or video." } };
    }

    const resolution = await resolveTarget(target);
    if (!resolution.success) {
      return resolution;
    }

    const feedResult = resolution.data.feedResult ?? await fetchUrl(resolution.data.feedLink);
    if (!feedResult.success) {
      return { success: false, error: mapFetchError(feedResult.error) };
    }

    const parsed = parseFeedContent(feedResult.data, maxItems);
    if (!parsed) {
      return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a YouTube channel feed." } };
    }

    return {
      success: true,
      data: {
        type: 'youtube',
        link: resolution.data.feedLink,
        title: parsed.title,
        description: parsed.description,
        items: parsed.items,
        icon: resolution.data.icon,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: { name: 'PARSE_ERROR', message: error.message } };
    }
    return { success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } };
  }
}

export const youtubeSource: SourceAdapter = {
  type: 'youtube',
  fetchesFullArticle: false,
  fetch: fetchFeed,
  parse: parseFeedContent,
};
