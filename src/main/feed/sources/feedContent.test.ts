// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { parseFeedContent } from './feedContent';

const HASHED_GUID = /^monfil:hash:[0-9a-f]{40}$/;

const rss = (channel: string) => `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>${channel}</channel></rss>`;
const atom = (feed: string) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${feed}</feed>`;
const rdf = (body: string) => `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">${body}</rdf:RDF>`;
const json = (feed: object) => JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', ...feed });

describe('parseFeedContent rss', () => {
  test('reads the feed and a complete item', () => {
    // Arrange
    const content = rss(`<title><![CDATA[Fish &#038; Chips]]></title><description>All about fish</description><link>https://fish.example/</link>
      <item>
        <title>First catch</title>
        <link>https://fish.example/1</link>
        <guid>fish-1</guid>
        <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
        <description><![CDATA[Caught &#8217;em]]></description>
        <dc:creator>Ann</dc:creator>
      </item>`);

    // Act
    const parsed = parseFeedContent(content);

    // Assert
    expect(parsed).toEqual({
      title: 'Fish & Chips',
      description: 'All about fish',
      siteLink: 'https://fish.example/',
      items: [{
        title: 'First catch',
        guid: 'fish-1',
        link: 'https://fish.example/1',
        pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT',
        description: 'Caught ’em',
        image: undefined,
        author: 'Ann',
        extra: undefined,
        read_at: undefined,
      }],
    });
  });

  test('an item with only a link has placeholders for its title and date, and the link as guid', () => {
    // Act
    const parsed = parseFeedContent(rss('<title>T</title><item><link>https://fish.example/2</link></item>'));

    // Assert
    expect(parsed?.items).toEqual([{
      title: 'No title',
      guid: 'https://fish.example/2',
      link: 'https://fish.example/2',
      pubDate: 'No publication date',
      description: '',
      image: undefined,
      author: undefined,
      extra: undefined,
      read_at: undefined,
    }]);
  });

  test('a feed with no title, no description and no item has empty text and no items', () => {
    // Act
    const parsed = parseFeedContent(rss('<link>https://fish.example/</link>'));

    // Assert
    expect(parsed).toEqual({ title: '', description: '', siteLink: 'https://fish.example/', items: [] });
  });
});

describe('parseFeedContent atom', () => {
  test('reads the feed and a complete entry', () => {
    // Arrange
    const content = atom(`<title>Fish &amp;amp; Chips</title><subtitle>All about fish</subtitle>
      <link rel="self" href="https://fish.example/feed.xml"/><link rel="alternate" href="https://fish.example/"/>
      <entry>
        <id>fish-1</id>
        <title>First catch</title>
        <link rel="alternate" href="https://fish.example/1"/>
        <published>2024-01-01T00:00:00Z</published>
        <updated>2024-02-02T00:00:00Z</updated>
        <summary>The summary</summary>
        <content>The content</content>
        <author><name>Ann</name></author>
      </entry>`);

    // Act
    const parsed = parseFeedContent(content);

    // Assert
    expect(parsed).toEqual({
      title: 'Fish & Chips',
      description: 'All about fish',
      siteLink: 'https://fish.example/',
      items: [{
        title: 'First catch',
        guid: 'fish-1',
        link: 'https://fish.example/1',
        pubDate: '2024-01-01T00:00:00Z',
        description: 'The summary',
        image: undefined,
        author: 'Ann',
        extra: undefined,
        read_at: undefined,
      }],
    });
  });

  test('the site link is the alternate link, or a link with no rel', () => {
    // Act
    const alternate = parseFeedContent(atom('<title>T</title><link rel="self" href="https://s.example/feed"/><link rel="alternate" href="https://site.example/"/>'));
    const plain = parseFeedContent(atom('<title>T</title><link rel="self" href="https://s.example/feed"/><link href="https://plain.example/"/>'));
    const none = parseFeedContent(atom('<title>T</title><link rel="self" href="https://s.example/feed"/>'));

    // Assert
    expect(alternate?.siteLink).toBe('https://site.example/');
    expect(plain?.siteLink).toBe('https://plain.example/');
    expect(none?.siteLink).toBeUndefined();
  });

  test.each([
    ['the alternate link, whatever its place', '<link rel="enclosure" href="https://e.example/"/><link rel="alternate" href="https://a.example/"/>', 'https://a.example/'],
    ['a link with no rel', '<link rel="enclosure" href="https://e.example/"/><link href="https://plain.example/"/>', 'https://plain.example/'],
    ['the first link when none is an alternate', '<link rel="self" href="https://s.example/"/><link rel="enclosure" href="https://e.example/"/>', 'https://s.example/'],
  ])('the link of an entry is %s', (_name, links, expected) => {
    // Act
    const parsed = parseFeedContent(atom(`<title>T</title><entry><id>x</id><title>E</title>${links}</entry>`));

    // Assert
    expect(parsed?.items[0]?.link).toBe(expected);
  });

  test('an entry with the content only, the updated date only and no title gets the content, the date and a placeholder', () => {
    // Act
    const parsed = parseFeedContent(atom('<title>T</title><entry><id>x</id><updated>2024-02-02T00:00:00Z</updated><content>The content</content></entry>'));

    // Assert
    expect(parsed?.items[0]).toMatchObject({ title: 'No title', pubDate: '2024-02-02T00:00:00Z', description: 'The content' });
  });

  test('an entry with no date gets a placeholder, and one with no id and no link a hashed guid', () => {
    // Act
    const parsed = parseFeedContent(atom('<title>T</title><entry><title>E</title></entry>'));

    // Assert
    expect(parsed?.items[0]).toMatchObject({ title: 'E', pubDate: 'No publication date', description: '', link: undefined, author: undefined });
    expect(parsed?.items[0]?.guid).toMatch(HASHED_GUID);
  });

  test('a feed with no title has an empty title', () => {
    // Act
    const parsed = parseFeedContent(atom('<id>feed</id>'));

    // Assert
    expect(parsed).toEqual({ title: '', description: '', siteLink: undefined, items: [] });
  });

  test('a feed with no subtitle and no entry has an empty description and no items', () => {
    // Act
    const parsed = parseFeedContent(atom('<title>T</title>'));

    // Assert
    expect(parsed).toEqual({ title: 'T', description: '', siteLink: undefined, items: [] });
  });
});

describe('parseFeedContent rdf', () => {
  test('reads the feed and an item', () => {
    // Arrange
    const content = rdf(`<channel rdf:about="https://old.example/"><title>Old news</title><link>https://old.example/</link><description>Very old</description></channel>
      <item rdf:about="https://old.example/1">
        <title>One</title>
        <link>https://old.example/1</link>
        <description>First</description>
        <dc:date>2024-01-01T00:00:00Z</dc:date>
        <dc:creator>Ann</dc:creator>
      </item>`);

    // Act
    const parsed = parseFeedContent(content);

    // Assert
    expect(parsed).toEqual({
      title: 'Old news',
      description: 'Very old',
      siteLink: 'https://old.example/',
      items: [{
        title: 'One',
        guid: 'https://old.example/1',
        link: 'https://old.example/1',
        pubDate: '2024-01-01T00:00:00Z',
        description: 'First',
        image: undefined,
        author: 'Ann',
        extra: undefined,
        read_at: undefined,
      }],
    });
  });

  test('an item with only a link has placeholders and no author', () => {
    // Act
    const parsed = parseFeedContent(rdf('<channel rdf:about="https://old.example/"><title>Old news</title></channel><item><link>https://old.example/2</link></item>'));

    // Assert
    expect(parsed?.items[0]).toEqual({
      title: 'No title',
      guid: 'https://old.example/2',
      link: 'https://old.example/2',
      pubDate: 'No publication date',
      description: '',
      image: undefined,
      author: undefined,
      extra: undefined,
      read_at: undefined,
    });
  });

  test('a feed with no description and no item has empty text and no items', () => {
    // Act
    const parsed = parseFeedContent(rdf('<channel rdf:about="https://old.example/"><link>https://old.example/</link></channel>'));

    // Assert
    expect(parsed).toEqual({ title: '', description: '', siteLink: 'https://old.example/', items: [] });
  });
});

describe('parseFeedContent json', () => {
  test('reads the feed and a complete item', () => {
    // Arrange
    const content = json({
      title: 'Fish &amp; Chips',
      description: 'All about fish',
      home_page_url: 'https://fish.example/',
      items: [{
        id: 'fish-1',
        url: 'https://fish.example/1',
        title: 'First catch',
        content_html: '<p>html</p>',
        content_text: 'text',
        summary: 'summary',
        date_published: '2024-01-01T00:00:00Z',
        authors: [{ name: 'Ann' }],
      }],
    });

    // Act
    const parsed = parseFeedContent(content);

    // Assert
    expect(parsed).toEqual({
      title: 'Fish & Chips',
      description: 'All about fish',
      siteLink: 'https://fish.example/',
      items: [{
        title: 'First catch',
        guid: 'fish-1',
        link: 'https://fish.example/1',
        pubDate: '2024-01-01T00:00:00Z',
        description: '<p>html</p>',
        image: undefined,
        author: 'Ann',
        extra: undefined,
        read_at: undefined,
      }],
    });
  });

  test('an item takes its description from the text, then from the summary', () => {
    // Act
    const parsed = parseFeedContent(json({ title: 'T', items: [{ id: '1', content_text: 'text', summary: 'summary' }, { id: '2', summary: 'summary' }] }));

    // Assert
    expect(parsed?.items.map((item) => item.description)).toEqual(['text', 'summary']);
  });

  test('an item with an empty author list has no author', () => {
    // Act
    const parsed = parseFeedContent(json({ title: 'T', items: [{ id: '1', authors: [] }] }));

    // Assert
    expect(parsed?.items[0]?.author).toBeUndefined();
  });

  test('an item with only an id has placeholders, and the id as guid', () => {
    // Act
    const parsed = parseFeedContent(json({ title: 'T', items: [{ id: '7' }] }));

    // Assert
    expect(parsed?.items).toEqual([{
      title: 'No title',
      guid: '7',
      link: undefined,
      pubDate: 'No publication date',
      description: '',
      image: undefined,
      author: undefined,
      extra: undefined,
      read_at: undefined,
    }]);
  });

  test('a feed with no title and no description has empty text', () => {
    // Act
    const parsed = parseFeedContent(json({ items: [{ id: '1' }] }));

    // Assert
    expect(parsed).toMatchObject({ title: '', description: '', siteLink: undefined });
  });
});

describe('parseFeedContent other content', () => {
  test('throws on content that is not a feed', () => {
    // Act / Assert
    expect(() => parseFeedContent('<html><body>hello</body></html>')).toThrow();
  });
});
