// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

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

  test('detects platform feeds from their URLs and leaves other feeds as rss', () => {
    // Arrange
    const xml = opml(`
      <outline type="rss" text="Playwright" xmlUrl="https://github.com/microsoft/playwright/releases.atom"/>
      <outline type="rss" text="cs.AI" xmlUrl="https://rss.arxiv.org/rss/cs.AI"/>
      <outline type="rss" text="HN" xmlUrl="https://hnrss.org/newest?points=300"/>
      <outline type="rss" text="Acme" xmlUrl="https://api.lever.co/v0/postings/acme?mode=json"/>
      <outline type="rss" text="Blog" xmlUrl="https://example.com/feed.xml"/>`);

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories[0]?.feeds.map((feed) => feed.type)).toEqual(['github', 'arxiv', 'hackernews', 'ats', 'rss']);
  });

  test('imports a document that holds a feed URL with a malformed percent-encoding', () => {
    // Arrange
    const xml = opml('<outline type="rss" text="Broken" xmlUrl="https://bsky.app/profile/%E0%A4%A/rss"/><outline type="rss" text="Blog" xmlUrl="https://example.com/feed.xml"/>');

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories[0]?.feeds.map((feed) => feed.type)).toEqual(['rss', 'rss']);
  });

  test('folds feeds nested several folders deep into the category at the top of the branch', () => {
    // Arrange
    const xml = opml(`
      <outline text="Tech">
        <outline text="Video">
          <outline text="Talks">
            <outline type="rss" text="Deep" xmlUrl="https://example.com/deep.xml"/>
          </outline>
        </outline>
      </outline>
    `);

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result).toEqual({
      success: true,
      data: { title: 'My feeds', categories: [{ name: 'Tech', feeds: [{ title: 'Deep', xmlUrl: 'https://example.com/deep.xml', type: 'rss' }] }] },
    });
  });

  test('leaves out a category that has no feeds', () => {
    // Arrange
    const xml = opml(`
      <outline text="Empty folder"></outline>
      <outline text="Folder of folders"><outline text="Still empty"></outline></outline>
      <outline text="Tech"><outline type="rss" text="Blog" xmlUrl="https://example.com/blog.xml"/></outline>
    `);

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories.map((category) => category.name)).toEqual(['Tech']);
  });

  test('adds the top-level feeds as a category after the folders', () => {
    // Arrange
    const xml = opml(`
      <outline type="rss" text="Loose" xmlUrl="https://example.com/loose.xml"/>
      <outline text="Tech"><outline type="rss" text="Blog" xmlUrl="https://example.com/blog.xml"/></outline>
    `, 'Mixed');

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.categories.map((category) => [category.name, category.feeds.map((feed) => feed.title)])).toEqual([
      ['Tech', ['Blog']],
      ['Mixed', ['Loose']],
    ]);
  });

  test('names a category "Imported" when its folder has no text', () => {
    // Arrange
    const xml = opml('<outline><outline type="rss" text="Blog" xmlUrl="https://example.com/blog.xml"/></outline>');

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success && result.data.categories.map((category) => category.name)).toEqual(['Imported']);
  });

  test('uses "Imported" for the title and the loose feeds category when the document has no head', () => {
    // Arrange
    const xml = '<?xml version="1.0"?><opml version="1.0"><body><outline type="rss" text="Blog" xmlUrl="https://example.com/blog.xml"/></body></opml>';

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result).toEqual({
      success: true,
      data: { title: 'Imported', categories: [{ name: 'Imported', feeds: [{ title: 'Blog', xmlUrl: 'https://example.com/blog.xml', type: 'rss' }] }] },
    });
  });

  test('names a feed from its title, then its text, then its URL', () => {
    // Arrange
    const xml = opml(`
      <outline type="rss" title="Title wins" text="Text" xmlUrl="https://example.com/a.xml"/>
      <outline type="rss" text="Text wins" xmlUrl="https://example.com/b.xml"/>
      <outline type="rss" xmlUrl="https://example.com/c.xml"/>
    `);

    // Act
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success && result.data.categories[0]?.feeds.map((feed) => feed.title)).toEqual(['Title wins', 'Text wins', 'https://example.com/c.xml']);
  });

  test('fails with NO_FEEDS when the body is empty', () => {
    // Act
    const result = parseOpmlDocument(opml(''));

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NO_FEEDS', message: expect.any(String) } });
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
