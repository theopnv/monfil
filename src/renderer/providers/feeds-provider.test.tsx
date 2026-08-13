import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FeedsProvider, useAddFeed, useFeeds } from './feeds-provider';
import type { Feed } from '../../preload/channels';

let nextFeedId = 1;

function createFeed(overrides: Partial<Feed> = {}): Feed {
  const id = nextFeedId++;
  return {
    id,
    link: `https://example.com/feed-${id}`,
    title: `Feed ${id}`,
    category_id: 1,
    showInHome: 1,
    category: { id: 1, name: 'Tech' },
    items: [],
    ...overrides,
  };
}

function FeedsList() {
  const feeds = useFeeds();
  return (
    <ul>
      {feeds.map((feed) => (
        <li key={feed.link}>{feed.title}</li>
      ))}
    </ul>
  );
}

function AddFeedButton({ feed }: { feed: Feed }) {
  const addFeed = useAddFeed();
  return (
    <button type="button" onClick={() => addFeed(feed)}>
      Add {feed.title}
    </button>
  );
}

beforeEach(() => {
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

test('a feed added via useAddFeed appears to useFeeds consumers', async () => {
  // Arrange
  const feedA = createFeed({ title: 'Feed A' });
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <AddFeedButton feed={feedA} />
      <FeedsList />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Add Feed A' }).click();

  // Assert
  await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();
});

test('re-adding the same link replaces the existing feed instead of duplicating it', async () => {
  // Arrange
  const originalFeed = createFeed({ link: 'https://example.com/shared', title: 'Original title' });
  const updatedFeed = createFeed({ link: 'https://example.com/shared', title: 'Updated title' });
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <AddFeedButton feed={originalFeed} />
      <AddFeedButton feed={updatedFeed} />
      <FeedsList />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Add Original title' }).click();
  await getByRole('button', { name: 'Add Updated title' }).click();

  // Assert
  await expect.element(getByText('Updated title', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Original title', { exact: true })).not.toBeInTheDocument();
});
