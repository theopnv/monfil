// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export type EmbedProvider = 'youtube' | 'x' | 'vimeo' | 'instagram' | 'spotify';

export interface EmbedDescriptor {
  provider: EmbedProvider;
  sourceUrl: string;
  frameUrl: string;
}

function youtubeId(url: URL, host: string, path: string[]): string | null | undefined {
  const [first, second] = path;
  if (host === 'youtu.be') {
    return first;
  }
  if (first === 'watch') {
    return url.searchParams.get('v');
  }
  return first === 'embed' || first === 'shorts' || first === 'live' ? second : undefined;
}

function resolveYoutube(url: URL, host: string, path: string[]): EmbedDescriptor | undefined {
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    return undefined;
  }
  const id = youtubeId(url, host, path);
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return undefined;
  }
  return {
    provider: 'youtube',
    sourceUrl: `https://www.youtube.com/watch?v=${id}`,
    frameUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}

function tweetId(url: URL, host: string, path: string[]): string | null | undefined {
  if (host === 'platform.twitter.com') {
    return path.join('/') === 'embed/Tweet.html' ? url.searchParams.get('id') : undefined;
  }
  return path[1] === 'status' ? path[2] : undefined;
}

function resolveX(url: URL, host: string, path: string[]): EmbedDescriptor | undefined {
  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'platform.twitter.com'].includes(host)) {
    return undefined;
  }
  const id = tweetId(url, host, path);
  const author = host === 'platform.twitter.com' ? 'i' : path[0];
  if (!id || !/^\d{5,25}$/.test(id) || author === undefined || !/^[A-Za-z0-9_]{1,15}$/.test(author)) {
    return undefined;
  }
  return {
    provider: 'x',
    sourceUrl: `https://x.com/${author}/status/${id}`,
    frameUrl: `https://platform.twitter.com/embed/Tweet.html?id=${id}`,
  };
}

function resolveVimeo(host: string, path: string[]): EmbedDescriptor | undefined {
  if (!['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    return undefined;
  }
  const [first, second] = path;
  const id = host === 'player.vimeo.com' ? first === 'video' ? second : undefined : first;
  if (!id || !/^\d{1,20}$/.test(id)) {
    return undefined;
  }
  return {
    provider: 'vimeo',
    sourceUrl: `https://vimeo.com/${id}`,
    frameUrl: `https://player.vimeo.com/video/${id}`,
  };
}

function resolveInstagram(host: string, path: string[]): EmbedDescriptor | undefined {
  if (host !== 'instagram.com' && host !== 'www.instagram.com') {
    return undefined;
  }
  const [kind, id] = path;
  if (kind === undefined || !['p', 'reel', 'tv'].includes(kind) || !id || !/^[A-Za-z0-9_-]{5,30}$/.test(id)) {
    return undefined;
  }
  return {
    provider: 'instagram',
    sourceUrl: `https://www.instagram.com/${kind}/${id}/`,
    frameUrl: `https://www.instagram.com/${kind}/${id}/embed/`,
  };
}

function resolveSpotify(host: string, path: string[]): EmbedDescriptor | undefined {
  if (host !== 'open.spotify.com') {
    return undefined;
  }
  const [kind, id] = path[0] === 'embed' ? path.slice(1) : path;
  if (kind === undefined || !['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(kind) || !id || !/^[A-Za-z0-9]{22}$/.test(id)) {
    return undefined;
  }
  return {
    provider: 'spotify',
    sourceUrl: `https://open.spotify.com/${kind}/${id}`,
    frameUrl: `https://open.spotify.com/embed/${kind}/${id}`,
  };
}

export function resolveEmbedUrl(input: string, baseUrl?: string): EmbedDescriptor | undefined {
  let url: URL;
  try {
    url = new URL(input, baseUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') {
    return undefined;
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname.split('/').filter(Boolean);
  return resolveYoutube(url, host, path) ?? resolveX(url, host, path) ?? resolveVimeo(host, path)
    ?? resolveInstagram(host, path) ?? resolveSpotify(host, path);
}
