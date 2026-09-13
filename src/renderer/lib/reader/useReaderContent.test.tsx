import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useReaderContent } from './useReaderContent';
import type { ArticleContentResult, Feed } from '../../../preload/channels';
import type { RiverItem } from '../river/utils';

function createFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 1,
    link: 'https://a.example/feed',
    title: 'Feed A',
    category_id: 1,
    type: 'rss',
    showInHome: 1,
    last_fetched_at: undefined,
    last_error: undefined,
    icon: undefined,
    category: { id: 1, name: 'Tech' },
    items: [{ id: 10, feed_id: 1, title: 'Item', link: 'https://a.example/item', guid: 'https://a.example/item', pubDate: '2024-01-01', description: '<p>Raw html description.</p>', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
    ...overrides,
  };
}

function createItem(overrides: Partial<RiverItem> = {}): RiverItem {
  return {
    id: 10,
    title: 'Item',
    link: 'https://a.example/item',
    pubDate: '2024-01-01',
    description: 'Raw html description.',
    feedTitle: 'Feed A',
    feedLink: 'https://a.example/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    image: undefined,
    type: 'rss',
    ...overrides,
  };
}

function Probe({ feeds, item }: { feeds: Feed[]; item: RiverItem | undefined }) {
  const content = useReaderContent(feeds, item);
  return (
    <div>
      <span data-testid="html">{content.html}</span>
      <span data-testid="word-count">{content.wordCount}</span>
      <span data-testid="standfirst">{content.standfirst}</span>
      <span data-testid="loading">{String(content.isLoading)}</span>
      <span data-testid="unavailable">{String(content.isUnavailable)}</span>
    </div>
  );
}

let invokeMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  invokeMock = vi.fn();
  window.electron = {
    ipcRenderer: {
      invoke: invokeMock,
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

describe('useReaderContent', () => {
  test('an rss item shows the raw description while the fetched article is loading', async () => {
    // Arrange
    invokeMock.mockReturnValue(new Promise(() => { }));
    const feeds = [createFeed()];
    const item = createItem();

    // Act
    const { getByTestId } = await render(<Probe feeds={feeds} item={item} />);

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('items:get-content', item.id);
    await expect.element(getByTestId('loading')).toHaveTextContent('true');
    await expect.element(getByTestId('html')).toHaveTextContent('Raw html description.');
  });

  test('an rss item switches to the fetched article once it is ready', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ status: 'ok', html: '<p>Full article</p>', wordCount: 42 } satisfies ArticleContentResult);
    const feeds = [createFeed()];
    const item = createItem();

    // Act
    const { getByTestId } = await render(<Probe feeds={feeds} item={item} />);

    // Assert
    await expect.element(getByTestId('html')).toHaveTextContent('Full article');
    await expect.element(getByTestId('word-count')).toHaveTextContent('42');
    await expect.element(getByTestId('loading')).toHaveTextContent('false');
    await expect.element(getByTestId('unavailable')).toHaveTextContent('false');
  });

  test('an rss item falls back to the raw description when the article is unavailable', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ status: 'unavailable' } satisfies ArticleContentResult);
    const feeds = [createFeed()];
    const item = createItem();

    // Act
    const { getByTestId } = await render(<Probe feeds={feeds} item={item} />);

    // Assert
    await expect.element(getByTestId('unavailable')).toHaveTextContent('true');
    await expect.element(getByTestId('html')).toHaveTextContent('Raw html description.');
  });

  test('an rss item derives a standfirst from its description', async () => {
    // Arrange
    invokeMock.mockReturnValue(new Promise(() => { }));
    const feeds = [createFeed()];
    const item = createItem({ description: 'A short teaser.' });

    // Act
    const { getByTestId } = await render(<Probe feeds={feeds} item={item} />);

    // Assert
    await expect.element(getByTestId('standfirst')).toHaveTextContent('A short teaser.');
  });

  test('a youtube item never asks main for a fetched article', async () => {
    // Arrange
    const feeds = [createFeed({ type: 'youtube', items: [{ id: 10, feed_id: 1, title: 'Video', link: 'https://youtube.com/watch?v=1', guid: 'yt:video:1', pubDate: '2024-01-01', description: 'Check https://example.com/more', image: undefined, author: undefined, extra: undefined, read_at: undefined }] })];
    const item = createItem({ type: 'youtube', description: 'Check https://example.com/more' });

    // Act
    const { getByTestId } = await render(<Probe feeds={feeds} item={item} />);

    // Assert
    expect(invokeMock).not.toHaveBeenCalled();
    await expect.element(getByTestId('loading')).toHaveTextContent('false');
    await expect.element(getByTestId('unavailable')).toHaveTextContent('false');
    await expect.element(getByTestId('standfirst')).toHaveTextContent('');
    // Rendered as literal text (no dangerouslySetInnerHTML here), so this proves the description
    // was escaped and linkified rather than passed through raw, the way an rss item's html is.
    await expect.element(getByTestId('html')).toHaveTextContent('Check <a href="https://example.com/more">https://example.com/more</a>');
  });

  test('renders no standfirst and an empty body while there is no current item', async () => {
    // Act
    const { getByTestId } = await render(<Probe feeds={[]} item={undefined} />);

    // Assert
    expect(invokeMock).not.toHaveBeenCalled();
    await expect.element(getByTestId('html')).toHaveTextContent('');
    await expect.element(getByTestId('standfirst')).toHaveTextContent('');
  });
});
