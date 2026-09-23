import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useReaderContent } from './useReaderContent';
import type { ItemBody, RiverRow } from '../../../shared/contracts';

function createItem(overrides: Partial<RiverRow> = {}): RiverRow {
  return {
    id: 10,
    title: 'Item',
    link: 'https://a.example/item',
    publishedAt: 1704067200000,
    excerpt: 'Raw html description.',
    feedTitle: 'Feed A',
    feedLink: 'https://a.example/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    image: undefined,
    readAt: undefined,
    feedId: 1,
    type: 'rss',
    ...overrides,
  };
}

function Probe({ item, refreshVersion = 0 }: { item: RiverRow | undefined; refreshVersion?: number }) {
  const content = useReaderContent(item, refreshVersion);
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
  test('an applied refresh reloads an open item', async () => {
    // Arrange
    const item = createItem();
    invokeMock.mockResolvedValueOnce({ description: 'Old', article: undefined }).mockResolvedValueOnce({ description: 'Edited', article: undefined });
    const screen = await render(<Probe item={item} />);
    await expect.element(screen.getByTestId('html')).toHaveTextContent('Old');

    // Act
    await screen.rerender(<Probe item={item} refreshVersion={1} />);

    // Assert
    await expect.element(screen.getByTestId('html')).toHaveTextContent('Edited');
  });

  test('an rss item shows the raw description while the fetched article is loading', async () => {
    // Arrange
    invokeMock.mockReturnValue(new Promise(() => { }));
    const item = createItem();

    // Act
    const { getByTestId } = await render(<Probe item={item} />);

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('items:get-content', item.id);
    await expect.element(getByTestId('loading')).toHaveTextContent('true');
  });

  test('an rss item switches to the fetched article once it is ready', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ description: 'Raw html description.', article: { html: '<p>Full article</p>', wordCount: 42 } } satisfies ItemBody);
    const item = createItem();

    // Act
    const { getByTestId } = await render(<Probe item={item} />);

    // Assert
    await expect.element(getByTestId('html')).toHaveTextContent('Full article');
    await expect.element(getByTestId('word-count')).toHaveTextContent('42');
    await expect.element(getByTestId('loading')).toHaveTextContent('false');
    await expect.element(getByTestId('unavailable')).toHaveTextContent('false');
  });

  test('changing the item fetches and shows the new article', async () => {
    // Arrange
    const first = createItem({ id: 10 });
    const second = createItem({ id: 20, excerpt: 'Second teaser.' });
    invokeMock.mockImplementation((_channel: string, itemId: number) => Promise.resolve({
      description: `Description ${itemId}`,
      article: { html: `<p>Article ${itemId}</p>`, wordCount: itemId },
    } satisfies ItemBody));
    const screen = await render(<Probe item={first} />);
    await expect.element(screen.getByTestId('html')).toHaveTextContent('Article 10');

    // Act
    await screen.rerender(<Probe item={second} />);

    // Assert
    expect(invokeMock).toHaveBeenLastCalledWith('items:get-content', second.id);
    await expect.element(screen.getByTestId('html')).toHaveTextContent('Article 20');
    await expect.element(screen.getByTestId('word-count')).toHaveTextContent('20');
  });

  test('an rss item falls back to the raw description when the article is unavailable', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ description: 'Raw html description.', article: undefined } satisfies ItemBody);
    const item = createItem();

    // Act
    const { getByTestId } = await render(<Probe item={item} />);

    // Assert
    await expect.element(getByTestId('unavailable')).toHaveTextContent('true');
    await expect.element(getByTestId('html')).toHaveTextContent('Raw html description.');
  });

  test('an rss item derives a standfirst from its excerpt', async () => {
    // Arrange
    invokeMock.mockReturnValue(new Promise(() => { }));
    const item = createItem({ excerpt: 'A short teaser.' });

    // Act
    const { getByTestId } = await render(<Probe item={item} />);

    // Assert
    await expect.element(getByTestId('standfirst')).toHaveTextContent('A short teaser.');
  });

  test('a youtube item never reports a loading or unavailable article', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ description: 'Check https://example.com/more', article: undefined } satisfies ItemBody);
    const item = createItem({ type: 'youtube', excerpt: 'Check https://example.com/more' });

    // Act
    const { getByTestId } = await render(<Probe item={item} />);

    // Assert
    await expect.element(getByTestId('loading')).toHaveTextContent('false');
    await expect.element(getByTestId('unavailable')).toHaveTextContent('false');
    await expect.element(getByTestId('standfirst')).toHaveTextContent('');
    // Rendered as literal text (no dangerouslySetInnerHTML here), so this proves the description
    // was escaped and linkified rather than passed through raw, the way an rss item's html is.
    await expect.element(getByTestId('html')).toHaveTextContent('Check <a href="https://example.com/more">https://example.com/more</a>');
  });

  test('renders no standfirst and an empty body while there is no current item', async () => {
    // Act
    const { getByTestId } = await render(<Probe item={undefined} />);

    // Assert
    expect(invokeMock).not.toHaveBeenCalled();
    await expect.element(getByTestId('html')).toHaveTextContent('');
    await expect.element(getByTestId('standfirst')).toHaveTextContent('');
  });
});
