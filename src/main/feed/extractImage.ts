import type { RssFeed } from 'feedsmith';

const IMG_SRC_REGEX = /<img[^>]+src=["']([^"']+)["']/i;

function firstImgSrc(html: string | undefined): string | undefined {
  return html ? IMG_SRC_REGEX.exec(html)?.[1] : undefined;
}

export function extractImageUrl(item: RssFeed.Item<string>): string | undefined {
  return (
    item.media?.thumbnails?.[0]?.url
    ?? item.media?.contents?.find((content) => content.medium === 'image' || content.type?.startsWith('image/'))?.url
    ?? item.enclosures?.find((enclosure) => enclosure.type?.startsWith('image/'))?.url
    ?? item.itunes?.image
    ?? firstImgSrc(item.content?.encoded)
    ?? firstImgSrc(item.description)
  );
}
