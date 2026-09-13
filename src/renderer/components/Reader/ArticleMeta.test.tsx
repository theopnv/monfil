import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import ArticleMeta from './ArticleMeta';
import type { RiverItem } from '@/lib/river/utils';

function createItem(overrides: Partial<RiverItem> = {}): RiverItem {
  return {
    id: 1,
    title: 'Item',
    link: 'https://example.com/item',
    pubDate: '2024-01-01',
    description: 'word '.repeat(400),
    feedTitle: 'Feed',
    feedLink: 'https://example.com/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    image: undefined,
    type: 'rss',
    ...overrides,
  };
}

test('renders no read time while the real word count is still loading', async () => {
  // Act
  const { getByText } = await render(<ArticleMeta item={createItem()} wordCount={undefined} />);

  // Assert: the excerpt has enough words for a multi-minute estimate, so "min read" showing up
  // here would prove it leaked in as a fallback instead of staying hidden until the real count arrives.
  const meta = getByText(/Feed/, { exact: false }).element();
  expect(meta.textContent).not.toContain('min read');
});

test('renders the read time once the real word count arrives', async () => {
  // Act
  const { getByText } = await render(<ArticleMeta item={createItem()} wordCount={200} />);

  // Assert
  const meta = getByText(/Feed/, { exact: false }).element();
  expect(meta.textContent).toContain('1 min read');
});
