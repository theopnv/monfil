// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import type { AtomFeed, RdfFeed, RssFeed } from 'feedsmith';
import { extractAtomImageUrl, extractImageUrl, extractRdfImageUrl } from './extractImage';

function item(overrides: Partial<RssFeed.Item<string>>): RssFeed.Item<string> {
  return { title: 'Item', ...overrides };
}

function rdfItem(overrides: Partial<RdfFeed.Item<string>>): RdfFeed.Item<string> {
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

  test('picks the image among several media:content entries', () => {
    const result = extractImageUrl(item({
      media: { contents: [{ url: 'https://example.com/video.mp4', type: 'video/mp4' }, { url: 'https://example.com/content.jpg', medium: 'image' }] },
    }));
    expect(result).toBe('https://example.com/content.jpg');
  });

  test('reads an image enclosure', () => {
    const result = extractImageUrl(item({ enclosures: [{ url: 'https://example.com/enclosure.jpg', type: 'image/jpeg', length: 100 }] }));
    expect(result).toBe('https://example.com/enclosure.jpg');
  });

  test('skips a non-image enclosure', () => {
    const result = extractImageUrl(item({ enclosures: [{ url: 'https://example.com/audio.mp3', type: 'audio/mpeg', length: 100 }] }));
    expect(result).toBeUndefined();
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

  test('prefers media:thumbnail over every other source', () => {
    const result = extractAtomImageUrl(entry({
      media: { thumbnails: [{ url: 'https://example.com/thumb.jpg' }] },
      links: [{ href: 'https://example.com/enclosure.jpg', rel: 'enclosure', type: 'image/jpeg' }],
      itunes: { image: 'https://example.com/itunes.jpg' },
      content: { value: '<img src="https://example.com/content.jpg">' },
    }));
    expect(result).toBe('https://example.com/thumb.jpg');
  });

  test('reads media:content with an image type, and skips one that is not an image', () => {
    const result = extractAtomImageUrl(entry({
      media: { contents: [{ url: 'https://example.com/video.mp4', type: 'video/mp4' }, { url: 'https://example.com/content.png', type: 'image/png' }] },
    }));
    expect(result).toBe('https://example.com/content.png');
  });

  test('skips media:content that is not an image', () => {
    const result = extractAtomImageUrl(entry({ media: { contents: [{ url: 'https://example.com/video.mp4', type: 'video/mp4' }] } }));
    expect(result).toBeUndefined();
  });

  test('skips an image link that is not an enclosure', () => {
    const result = extractAtomImageUrl(entry({ links: [{ href: 'https://example.com/page.png', rel: 'alternate', type: 'image/png' }] }));
    expect(result).toBeUndefined();
  });
});

describe('extractRdfImageUrl', () => {

  test('reads media:content with an image medium', () => {
    const result = extractRdfImageUrl(rdfItem({ media: { contents: [{ url: 'https://example.com/content.jpg', medium: 'image' }] } }));
    expect(result).toBe('https://example.com/content.jpg');
  });

  test('reads media:content with an image type, and skips one that is not an image', () => {
    const result = extractRdfImageUrl(rdfItem({
      media: { contents: [{ url: 'https://example.com/video.mp4', type: 'video/mp4' }, { url: 'https://example.com/content.png', type: 'image/png' }] },
    }));
    expect(result).toBe('https://example.com/content.png');
  });

  test('skips media:content that is not an image', () => {
    const result = extractRdfImageUrl(rdfItem({ media: { contents: [{ url: 'https://example.com/video.mp4', type: 'video/mp4' }] } }));
    expect(result).toBeUndefined();
  });

  test('prefers media:thumbnail over every other source', () => {
    const result = extractRdfImageUrl(rdfItem({
      media: { thumbnails: [{ url: 'https://example.com/thumb.jpg' }], contents: [{ url: 'https://example.com/content.jpg', medium: 'image' }] },
      description: '<img src="https://example.com/description.jpg">',
    }));
    expect(result).toBe('https://example.com/thumb.jpg');
  });
});
