// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { findAlternateLinks, probeLinks } from './discovery';

describe('findAlternateLinks', () => {
  test('reads RSS, Atom and JSON Feed links in page order and resolves relative hrefs', () => {
    // Arrange
    const html = `
      <head>
        <link rel="stylesheet" href="/style.css">
        <link rel="alternate" type="application/rss+xml" title="Posts" href="/feed.xml">
        <link href='https://cdn.test/atom.xml' type='application/atom+xml' rel='alternate'>
        <link rel="alternate" type="application/feed+json" href="feed.json?a=1&amp;b=2">
        <link rel="alternate" hreflang="fr" href="/fr/">
      </head>`;

    // Act
    const links = findAlternateLinks(html, 'https://blog.test/posts/');

    // Assert
    expect(links).toEqual([
      'https://blog.test/feed.xml',
      'https://cdn.test/atom.xml',
      'https://blog.test/posts/feed.json?a=1&b=2',
    ]);
  });

  test('ignores duplicates and links with an unsafe scheme', () => {
    // Arrange
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/feed">
      <link rel="alternate" type="application/rss+xml" href="https://blog.test/feed">
      <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">`;

    // Act
    const links = findAlternateLinks(html, 'https://blog.test/');

    // Assert
    expect(links).toEqual(['https://blog.test/feed']);
  });

  test('ignores feed links outside the head, where page content could inject them', () => {
    // Arrange
    const html = `<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>
      <body><div class="comment"><link rel="alternate" type="application/rss+xml" href="https://attacker.test/feed.xml"></div></body></html>`;

    // Act
    const links = findAlternateLinks(html, 'https://blog.test/');

    // Assert
    expect(links).toEqual(['https://blog.test/feed.xml']);
  });

  test('stops at the body when the page leaves out its closing head tag', () => {
    // Arrange
    const html = '<link rel="alternate" type="application/rss+xml" href="/feed.xml"><body><link rel="alternate" type="application/rss+xml" href="/injected.xml">';

    // Act
    const links = findAlternateLinks(html, 'https://blog.test/');

    // Assert
    expect(links).toEqual(['https://blog.test/feed.xml']);
  });

  test('reads a feed type that carries a parameter and spaces, in any letter case', () => {
    // Arrange
    const html = '<link rel="alternate" type="Application/RSS+XML ; charset=utf-8" href="/feed.xml">';

    // Act
    const links = findAlternateLinks(html, 'https://blog.test/');

    // Assert
    expect(links).toEqual(['https://blog.test/feed.xml']);
  });

  test('returns nothing for a page without feed links', () => {
    // Act / Assert
    expect(findAlternateLinks('<html><head><title>x</title></head></html>', 'https://blog.test/')).toEqual([]);
  });
});

describe('probeLinks', () => {
  test('lists the common feed paths on the page origin in a fixed order', () => {
    // Act / Assert
    expect(probeLinks('https://blog.test/some/page?x=1')).toEqual([
      'https://blog.test/feed',
      'https://blog.test/rss.xml',
      'https://blog.test/atom.xml',
      'https://blog.test/index.xml',
      'https://blog.test/feed.xml',
    ]);
  });
});
