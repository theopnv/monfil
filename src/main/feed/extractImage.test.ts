import { describe, expect, test } from 'vitest';
import type { AtomFeed, RssFeed } from 'feedsmith';
import { extractAtomImageUrl, extractImageUrl } from './extractImage';

function item(overrides: Partial<RssFeed.Item<string>>): RssFeed.Item<string> {
  return { title: 'Item', ...overrides };
}

function entry(overrides: Partial<AtomFeed.Entry<string>>): AtomFeed.Entry<string> {
  return { title: { value: 'Item' }, ...overrides };
}

describe('extractImageUrl', () => {
  test('reads media:thumbnail', () => {
    const result = extractImageUrl(item({ media: { thumbnails: [{ url: 'https://example.com/thumb.jpg' }] } }));
    expect(result).toBe('https://example.com/thumb.jpg');
  });

  test('reads media:content with an image medium', () => {
    const result = extractImageUrl(item({ media: { contents: [{ url: 'https://example.com/content.jpg', medium: 'image' }] } }));
    expect(result).toBe('https://example.com/content.jpg');
  });

  test('reads media:content with an image type', () => {
    const result = extractImageUrl(item({ media: { contents: [{ url: 'https://example.com/content.png', type: 'image/png' }] } }));
    expect(result).toBe('https://example.com/content.png');
  });

  test('skips a media:content that is not an image', () => {
    const result = extractImageUrl(item({ media: { contents: [{ url: 'https://example.com/video.mp4', type: 'video/mp4' }] } }));
    expect(result).toBeUndefined();
  });

  test('reads an image enclosure', () => {
    const result = extractImageUrl(item({ enclosures: [{ url: 'https://example.com/enclosure.jpg', type: 'image/jpeg', length: 100 }] }));
    expect(result).toBe('https://example.com/enclosure.jpg');
  });

  test('skips a non-image enclosure', () => {
    const result = extractImageUrl(item({ enclosures: [{ url: 'https://example.com/audio.mp3', type: 'audio/mpeg', length: 100 }] }));
    expect(result).toBeUndefined();
  });

  test('reads itunes:image', () => {
    const result = extractImageUrl(item({ itunes: { image: 'https://example.com/itunes.jpg' } }));
    expect(result).toBe('https://example.com/itunes.jpg');
  });

  test('falls back to the first img in content:encoded', () => {
    const result = extractImageUrl(item({ content: { encoded: '<p>intro</p><img src="https://example.com/encoded.jpg" alt="">' } }));
    expect(result).toBe('https://example.com/encoded.jpg');
  });

  test('falls back to the first img in description', () => {
    const result = extractImageUrl(item({ description: '<p>intro</p><img src="https://example.com/description.jpg" alt="">' }));
    expect(result).toBe('https://example.com/description.jpg');
  });

  test('prefers content:encoded over description when both have an image', () => {
    const result = extractImageUrl(item({
      content: { encoded: '<img src="https://example.com/encoded.jpg">' },
      description: '<img src="https://example.com/description.jpg">',
    }));
    expect(result).toBe('https://example.com/encoded.jpg');
  });

  test('prefers media:thumbnail over every other source', () => {
    const result = extractImageUrl(item({
      media: { thumbnails: [{ url: 'https://example.com/thumb.jpg' }] },
      enclosures: [{ url: 'https://example.com/enclosure.jpg', type: 'image/jpeg', length: 100 }],
      itunes: { image: 'https://example.com/itunes.jpg' },
      content: { encoded: '<img src="https://example.com/encoded.jpg">' },
    }));
    expect(result).toBe('https://example.com/thumb.jpg');
  });

  test('returns undefined when no source has an image', () => {
    const result = extractImageUrl(item({ description: '<p>no image here</p>' }));
    expect(result).toBeUndefined();
  });
});

describe('extractAtomImageUrl', () => {
  test('reads media:thumbnail', () => {
    const result = extractAtomImageUrl(entry({ media: { thumbnails: [{ url: 'https://example.com/thumb.jpg' }] } }));
    expect(result).toBe('https://example.com/thumb.jpg');
  });

  test('reads media:content with an image medium', () => {
    const result = extractAtomImageUrl(entry({ media: { contents: [{ url: 'https://example.com/content.jpg', medium: 'image' }] } }));
    expect(result).toBe('https://example.com/content.jpg');
  });

  test('reads an image enclosure link', () => {
    const result = extractAtomImageUrl(entry({ links: [{ href: 'https://example.com/enclosure.jpg', rel: 'enclosure', type: 'image/jpeg' }] }));
    expect(result).toBe('https://example.com/enclosure.jpg');
  });

  test('skips a non-image enclosure link', () => {
    const result = extractAtomImageUrl(entry({ links: [{ href: 'https://example.com/audio.mp3', rel: 'enclosure', type: 'audio/mpeg' }] }));
    expect(result).toBeUndefined();
  });

  test('reads itunes:image', () => {
    const result = extractAtomImageUrl(entry({ itunes: { image: 'https://example.com/itunes.jpg' } }));
    expect(result).toBe('https://example.com/itunes.jpg');
  });

  test('falls back to the first img in content', () => {
    const result = extractAtomImageUrl(entry({ content: { value: '<p>intro</p><img src="https://example.com/content.jpg" alt="">' } }));
    expect(result).toBe('https://example.com/content.jpg');
  });

  test('falls back to the first img in summary', () => {
    const result = extractAtomImageUrl(entry({ summary: { value: '<p>intro</p><img src="https://example.com/summary.jpg" alt="">' } }));
    expect(result).toBe('https://example.com/summary.jpg');
  });

  test('prefers content over summary when both have an image', () => {
    const result = extractAtomImageUrl(entry({
      content: { value: '<img src="https://example.com/content.jpg">' },
      summary: { value: '<img src="https://example.com/summary.jpg">' },
    }));
    expect(result).toBe('https://example.com/content.jpg');
  });

  test('prefers media:thumbnail over every other source', () => {
    const result = extractAtomImageUrl(entry({
      media: { thumbnails: [{ url: 'https://example.com/thumb.jpg' }] },
      links: [{ href: 'https://example.com/enclosure.jpg', rel: 'enclosure', type: 'image/jpeg' }],
      itunes: { image: 'https://example.com/itunes.jpg' },
      content: { value: '<img src="https://example.com/content.jpg">' },
    }));
    expect(result).toBe('https://example.com/thumb.jpg');
  });

  test('returns undefined when no source has an image', () => {
    const result = extractAtomImageUrl(entry({ summary: { value: '<p>no image here</p>' } }));
    expect(result).toBeUndefined();
  });
});
