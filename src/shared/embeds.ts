export type EmbedProvider = 'youtube' | 'x' | 'vimeo' | 'instagram' | 'spotify';

export interface EmbedDescriptor {
  provider: EmbedProvider;
  sourceUrl: string;
  frameUrl: string;
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

  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com'
    || host === 'youtu.be' || host === 'www.youtube-nocookie.com') {
    const id = host === 'youtu.be' ? path[0]
      : path[0] === 'watch' ? url.searchParams.get('v')
        : path[0] === 'embed' || path[0] === 'shorts' || path[0] === 'live' ? path[1] : undefined;
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      return {
        provider: 'youtube',
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
        frameUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  if (host === 'x.com' || host === 'www.x.com' || host === 'twitter.com' || host === 'www.twitter.com'
    || host === 'mobile.twitter.com' || host === 'platform.twitter.com') {
    const id = host === 'platform.twitter.com' && path.join('/') === 'embed/Tweet.html'
      ? url.searchParams.get('id') : path[1] === 'status' ? path[2] : undefined;
    if (id && /^\d{5,25}$/.test(id) && (host === 'platform.twitter.com' || /^[A-Za-z0-9_]{1,15}$/.test(path[0] ?? ''))) {
      const author = host === 'platform.twitter.com' ? 'i' : path[0];
      return {
        provider: 'x',
        sourceUrl: `https://x.com/${author}/status/${id}`,
        frameUrl: `https://platform.twitter.com/embed/Tweet.html?id=${id}`,
      };
    }
  }

  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    const id = host === 'player.vimeo.com' && path[0] === 'video' ? path[1] : path[0];
    if (id && /^\d{1,20}$/.test(id)) {
      return {
        provider: 'vimeo',
        sourceUrl: `https://vimeo.com/${id}`,
        frameUrl: `https://player.vimeo.com/video/${id}`,
      };
    }
  }

  if (host === 'instagram.com' || host === 'www.instagram.com') {
    const kind = path[0];
    const id = path[1];
    if ((kind === 'p' || kind === 'reel' || kind === 'tv') && id && /^[A-Za-z0-9_-]{5,30}$/.test(id)) {
      return {
        provider: 'instagram',
        sourceUrl: `https://www.instagram.com/${kind}/${id}/`,
        frameUrl: `https://www.instagram.com/${kind}/${id}/embed/`,
      };
    }
  }

  if (host === 'open.spotify.com') {
    const kind = path[0] === 'embed' ? path[1] : path[0];
    const id = path[0] === 'embed' ? path[2] : path[1];
    if ((kind === 'track' || kind === 'album' || kind === 'playlist' || kind === 'episode' || kind === 'show' || kind === 'artist')
      && id && /^[A-Za-z0-9]{22}$/.test(id)) {
      return {
        provider: 'spotify',
        sourceUrl: `https://open.spotify.com/${kind}/${id}`,
        frameUrl: `https://open.spotify.com/embed/${kind}/${id}`,
      };
    }
  }

  return undefined;
}
