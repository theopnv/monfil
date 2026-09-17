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
});
