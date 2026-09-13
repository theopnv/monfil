import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import AddFeedModal from './AddFeedModal';
import { FeedsProvider } from '@/providers/feeds-provider';
import type { Result } from '../../../main/lib/utils';
import type { AddFeedError } from '../../../main/db/crud/insert';
import type { Feed, FeedCategory, FeedFetchError, ParsedSource, TwoWayRendererMainChannelsInvokeArgs, TwoWayRendererMainChannelPayloads } from '../../../preload/channels';

const categories: FeedCategory[] = [{ id: 1, name: 'Tech' }];

const parsedFeed: ParsedSource = {
  type: 'rss',
  link: 'https://example.com/feed',
  title: 'Example Feed',
  description: 'A feed about examples.',
  icon: undefined,
  items: [{ title: 'Item 1', guid: 'https://example.com/item1', link: 'https://example.com/item1', pubDate: '2024-01-01', description: 'd', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
};

const insertedFeed: Feed = {
  id: 1,
  link: parsedFeed.link,
  title: parsedFeed.title,
  type: 'rss',
  category_id: 1,
  showInHome: 1,
  last_fetched_at: undefined,
  last_error: undefined,
  icon: undefined,
  category: { id: 1, name: 'Tech' },
  items: [{ id: 1, feed_id: 1, title: 'Item 1', guid: 'https://example.com/item1', link: 'https://example.com/item1', pubDate: '2024-01-01', description: 'd', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
};

let invokeMock: ReturnType<typeof vi.fn>;

function stubElectron(overrides: {
  validateFeedUrl?: Result<ParsedSource, FeedFetchError>;
  submitAddFeed?: Result<Feed, AddFeedError>;
} = {}) {
  invokeMock = vi.fn(<C extends keyof TwoWayRendererMainChannelsInvokeArgs>(channel: C): Promise<TwoWayRendererMainChannelPayloads[C]> => {
    switch (channel) {
      case 'feeds:list-categories':
        return Promise.resolve(categories) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:list':
        return Promise.resolve([] as Feed[]) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:validate-feed-url':
        return Promise.resolve(overrides.validateFeedUrl ?? { success: true, data: parsedFeed }) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:submit-add-feed':
        return Promise.resolve(overrides.submitAddFeed ?? { success: true, data: insertedFeed }) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      default:
        return Promise.resolve(undefined) as unknown as Promise<TwoWayRendererMainChannelPayloads[C]>;
    }
  });

  window.electron = {
    ipcRenderer: {
      invoke: invokeMock,
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
}

beforeEach(() => {
  stubElectron();
});

describe('AddFeedModal', () => {
  test('finds a feed, configures it, and shows the backfilled result', async () => {
    // Arrange
    const { getByLabelText, getByRole, getByText } = await render(
      <FeedsProvider>
        <AddFeedModal isOpen onOpenChange={vi.fn()} />
      </FeedsProvider>,
    );

    // Act: Step 1 — the URL resolves to a feed via the real validation call.
    await getByLabelText('Feed URL').fill('example.com/feed');
    await expect.element(getByText('Feed found', { exact: true })).toBeInTheDocument();
    await getByRole('button', { name: 'Continue' }).click();

    // Act: Step 2 — pick the only existing category and submit.
    await expect.element(getByRole('heading', { name: 'Make it yours' })).toBeInTheDocument();
    await getByText('Tech', { exact: true }).click();
    await getByRole('button', { name: 'Add source' }).click();

    // Assert: Step 3 shows the real, post-insert feed with its backfilled items.
    await expect.element(getByText(/is in Tech/)).toBeInTheDocument();
    await expect.element(getByText('Item 1')).toBeInTheDocument();
  });

  test('selecting YouTube sends the type hint to the validation call', async () => {
    // Arrange
    const { getByLabelText, getByRole, getByText } = await render(
      <FeedsProvider>
        <AddFeedModal isOpen onOpenChange={vi.fn()} />
      </FeedsProvider>,
    );

    // Act
    await getByRole('button', { name: 'YouTube' }).click();
    await getByLabelText('Feed URL').fill('Underscore_');
    await expect.element(getByText('Feed found', { exact: true })).toBeInTheDocument();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('feeds:validate-feed-url', { query: 'Underscore_', type: 'youtube' });
  });

  test('switching the type toggle re-validates the same, unchanged text', async () => {
    // Arrange
    const { getByLabelText, getByRole, getByText } = await render(
      <FeedsProvider>
        <AddFeedModal isOpen onOpenChange={vi.fn()} />
      </FeedsProvider>,
    );
    await getByLabelText('Feed URL').fill('example.com/feed');
    await expect.element(getByText('Feed found', { exact: true })).toBeInTheDocument();
    invokeMock.mockClear();

    // Act: the text is unchanged, only the toggle moves.
    await getByRole('button', { name: 'RSS · Atom' }).click();

    // Assert
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('feeds:validate-feed-url', { query: 'example.com/feed', type: 'rss' });
    }, { timeout: 2000 });
  });

  test('keeps Continue disabled when the url does not resolve to a feed', async () => {
    // Arrange
    stubElectron({ validateFeedUrl: { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: 'nope' } } });
    const { getByLabelText, getByRole, getByText } = await render(
      <FeedsProvider>
        <AddFeedModal isOpen onOpenChange={vi.fn()} />
      </FeedsProvider>,
    );

    // Act
    await getByLabelText('Feed URL').fill('not-a-feed.example');
    await expect.element(getByText('Not found', { exact: true })).toBeInTheDocument();

    // Assert
    await expect.element(getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
