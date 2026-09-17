import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { parseOpmlDocument } from './parse';

function opml(body: string, headTitle = 'My feeds'): string {
  return `<?xml version="1.0" encoding="UTF-8"?><opml version="1.0"><head><title>${headTitle}</title></head><body>${body}</body></opml>`;
}

describe('parseOpmlDocument', () => {
  test('parses a Feedly-shaped export into one category per folder', () => {
    // Arrange
    const xml = readFileSync(path.join(import.meta.dirname, '__fixtures__/feedly-export.opml'), 'utf-8');

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories.map((category) => category.name)).toEqual(['Tech', 'Testing']);
    expect(result.data.categories[0]?.feeds.map((feed) => feed.title)).toEqual(['Ars Technica', 'Hacker News']);
    expect(result.data.categories[0]?.feeds[0]?.xmlUrl).toBe('https://feeds.arstechnica.com/arstechnica/index');
    expect(result.data.categories[0]?.feeds[0]?.htmlUrl).toBe('https://arstechnica.com');
    expect(result.data.categories[0]?.feeds[0]?.type).toBe('rss');
  });

  test('folds a sub-folder inside a folder into that folder\'s category', () => {
    // Arrange
    const xml = opml(`
      <outline text="Tech">
        <outline text="Videos">
          <outline type="rss" text="Channel" xmlUrl="https://example.com/channel.xml"/>
        </outline>
        <outline type="rss" text="Blog" xmlUrl="https://example.com/blog.xml"/>
      </outline>
    `);

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories).toHaveLength(1);
    expect(result.data.categories[0]?.name).toBe('Tech');
    expect(result.data.categories[0]?.feeds.map((feed) => feed.title)).toEqual(['Channel', 'Blog']);
  });

  test('groups top-level leaves with no folder under the document title', () => {
    // Arrange
    const xml = opml(
      '<outline type="rss" text="Blog" xmlUrl="https://example.com/blog.xml"/>',
      'Flat export',
    );

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories).toEqual([{ name: 'Flat export', feeds: [{ title: 'Blog', xmlUrl: 'https://example.com/blog.xml', type: 'rss' }] }]);
  });

  test('detects a YouTube feed from its URL regardless of the outline type attribute', () => {
    // Arrange
    const xml = opml('<outline type="rss" text="Channel" xmlUrl="https://www.youtube.com/feeds/videos.xml?channel_id=UC123"/>');

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories[0]?.feeds[0]?.type).toBe('youtube');
  });

  test('fails with MALFORMED_XML on unparsable input', () => {
    // Act
    const result = parseOpmlDocument('not xml at all <<<');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'MALFORMED_XML', message: expect.any(String) } });
  });

  test('fails with NO_FEEDS when the document has no feeds', () => {
    // Act
    const result = parseOpmlDocument(opml('<outline text="Empty folder"></outline>'));

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NO_FEEDS', message: expect.any(String) } });
  });
});
