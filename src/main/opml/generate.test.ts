// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { parseOpml } from 'feedsmith';
import { describe, expect, test } from 'vitest';
import { generateWorkspaceOpml } from './generate';
import { parseOpmlDocument } from './parse';

describe('generateWorkspaceOpml', () => {
  test('round-trips through parseOpmlDocument with the same categories and feeds', () => {
    // Arrange
    const categories = [
      { name: 'Tech', feeds: [{ title: 'Ars Technica', xmlUrl: 'https://feeds.arstechnica.com/arstechnica/index', htmlUrl: 'https://arstechnica.com' }] },
      { name: 'Testing', feeds: [{ title: 'Testing Blog', xmlUrl: 'https://testing.example/feed' }] },
    ];

    // Act
    const xml = generateWorkspaceOpml('CI/CD watch', categories);
    const result = parseOpmlDocument(xml);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.title).toBe('CI/CD watch');
    expect(result.data.categories).toEqual([
      { name: 'Tech', feeds: [{ title: 'Ars Technica', xmlUrl: 'https://feeds.arstechnica.com/arstechnica/index', htmlUrl: 'https://arstechnica.com', type: 'rss' }] },
      { name: 'Testing', feeds: [{ title: 'Testing Blog', xmlUrl: 'https://testing.example/feed', type: 'rss' }] },
    ]);
  });

  test('marks each feed outline as type rss, as other readers expect', () => {
    // Act
    const xml = generateWorkspaceOpml('Releases', [{ name: 'Tech', feeds: [{ title: 'Blog', xmlUrl: 'https://example.com/feed' }] }]);

    // Assert
    const outline = parseOpml(xml).body?.outlines?.[0]?.outlines?.[0];
    expect(outline).toMatchObject({ type: 'rss', text: 'Blog', title: 'Blog', xmlUrl: 'https://example.com/feed' });
    expect(outline?.htmlUrl).toBeUndefined();
  });
});
