import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FeedsProvider, useFeeds } from '@/providers/feeds-provider';
import RiverSidebar from './RiverSidebar';
import type { DeleteFeedError } from '../../../main/db/delete';
import type { Feed } from '../../../preload/channels';
import type { Result } from '../../../utils';
import type { TwoWayRendererMainChannelPayloads, TwoWayRendererMainChannelsInvokeArgs } from '../../../preload/channels';

const feedA: Feed = {
  id: 1,
  link: 'https://a.example/feed',
  title: 'Feed A',
  category_id: 1,
  showInHome: 1,
  category: { id: 1, name: 'Tech' },
  items: [{ id: 1, feed_id: 1, title: 'Item 1', link: 'https://a.example/feed#1', pubDate: '2024-01-01', description: '', image: undefined, read_at: undefined }],
};

const feedB: Feed = {
  id: 2,
  link: 'https://b.example/feed',
  title: 'Feed B',
  category_id: 1,
  showInHome: 1,
  category: { id: 1, name: 'Tech' },
  items: [],
};

let deleteFeedRequestedHandler: ((feedId: number) => void) | undefined;
let invokeMock: ReturnType<typeof vi.fn>;

function stubElectron(overrides: {
  feeds?: Feed[];
  deleteFeed?: Result<Feed[], DeleteFeedError>;
} = {}) {
  deleteFeedRequestedHandler = undefined;

  invokeMock = vi.fn(<C extends keyof TwoWayRendererMainChannelsInvokeArgs>(channel: C): Promise<TwoWayRendererMainChannelPayloads[C]> => {
    switch (channel) {
      case 'feeds:list':
        return Promise.resolve(overrides.feeds ?? []) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:delete-feed':
        return Promise.resolve(overrides.deleteFeed ?? { success: true, data: [] }) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      default:
        return Promise.resolve(undefined) as unknown as Promise<TwoWayRendererMainChannelPayloads[C]>;
    }
  });

  window.electron = {
    ipcRenderer: {
      invoke: invokeMock,
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'feeds:delete-feed-requested') {
          deleteFeedRequestedHandler = handler as typeof deleteFeedRequestedHandler;
        }
        return vi.fn();
      }),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
}

function ConnectedSidebar({ onFeedDeleted }: { onFeedDeleted: (feed: Feed) => void }) {
  const feeds = useFeeds();
  return <RiverSidebar feeds={feeds} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={onFeedDeleted} />;
}

beforeEach(() => {
  stubElectron();
  localStorage.clear();
});

test('clicking "Add feed" opens the add-feed modal', async () => {
  // Arrange
  const { getByRole } = await render(
    <FeedsProvider>
      <RiverSidebar feeds={[]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />
    </FeedsProvider>,
  );
  await expect.element(getByRole('heading', { name: 'Add a source' })).not.toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Add feed' }).click();

  // Assert
  await expect.element(getByRole('heading', { name: 'Add a source' })).toBeInTheDocument();
});

describe('feed row visibility rotation', () => {
  test('clicking a home feed row asks to show it only', async () => {
    // Arrange
    const onSetVisibility = vi.fn();
    const { getByRole } = await render(
      <FeedsProvider>
        <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Act
    await getByRole('button', { name: /Feed A/ }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA], 'only');
  });

  test('clicking an only feed row asks to hide it', async () => {
    // Arrange
    const onSetVisibility = vi.fn();
    const { getByRole } = await render(
      <FeedsProvider>
        <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set([feedA.link])} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Act
    await getByRole('button', { name: /Feed A/ }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA], 'hidden');
  });

  test('clicking a hidden feed row asks to show it with the others', async () => {
    // Arrange
    const hiddenFeedA: Feed = { ...feedA, showInHome: 0 };
    const onSetVisibility = vi.fn();
    const { getByRole } = await render(
      <FeedsProvider>
        <RiverSidebar feeds={[hiddenFeedA]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Act
    await getByRole('button', { name: /Feed A/ }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([hiddenFeedA], 'home');
  });
});

describe('folder visibility rotation', () => {
  test('the rotate button applies the next state to every feed in the folder', async () => {
    // Arrange
    const onSetVisibility = vi.fn();
    const { getByRole } = await render(
      <FeedsProvider>
        <RiverSidebar feeds={[feedA, feedB]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );

    // Act
    await getByRole('button', { name: 'Show only: Tech' }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA, feedB], 'only');
  });

  test('a mixed folder resets to home on the first click', async () => {
    // Arrange
    const hiddenFeedB: Feed = { ...feedB, showInHome: 0 };
    const onSetVisibility = vi.fn();
    const { getByRole } = await render(
      <FeedsProvider>
        <RiverSidebar feeds={[feedA, hiddenFeedB]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );

    // Act
    await getByRole('button', { name: 'Show with others: Tech' }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA, hiddenFeedB], 'home');
  });

  test('the expand button still toggles the folder open and closed', async () => {
    // Arrange
    const { getByRole, getByText } = await render(
      <FeedsProvider>
        <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    await expect.element(getByText('Feed A', { exact: true })).not.toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();
  });
});

describe('feed row context menu and delete', () => {
  test('right-clicking a feed row sends feeds:show-feed-context-menu with the feed id', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole, getByText } = await render(
      <FeedsProvider>
        <ConnectedSidebar onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();
    await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();

    // Act
    await getByText('Feed A', { exact: true }).click({ button: 'right' });

    // Assert
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('feeds:show-feed-context-menu', feedA.id);
  });

  test('firing feeds:delete-feed-requested opens the dialog naming the feed and its item count', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByText, getByRole } = await render(
      <FeedsProvider>
        <ConnectedSidebar onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    await expect.element(getByRole('heading', { name: 'Delete feed' })).not.toBeInTheDocument();

    // Act
    deleteFeedRequestedHandler?.(feedA.id);

    // Assert
    await expect.element(getByRole('heading', { name: 'Delete feed' })).toBeInTheDocument();
    await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();
    await expect.element(getByText('1 item', { exact: true })).toBeInTheDocument();
  });

  test('cancel closes the dialog and invokes nothing', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole } = await render(
      <FeedsProvider>
        <ConnectedSidebar onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    deleteFeedRequestedHandler?.(feedA.id);
    await expect.element(getByRole('heading', { name: 'Delete feed' })).toBeInTheDocument();
    invokeMock.mockClear();

    // Act
    await getByRole('button', { name: 'Cancel' }).click();

    // Assert
    await expect.element(getByRole('heading', { name: 'Delete feed' })).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith('feeds:delete-feed', expect.anything());
  });

  test('confirm invokes feeds:delete-feed with the feed id, drops the row, and calls onFeedDeleted', async () => {
    // Arrange
    stubElectron({ feeds: [feedA, feedB], deleteFeed: { success: true, data: [feedB] } });
    const onFeedDeleted = vi.fn();
    const { getByText, getByRole } = await render(
      <FeedsProvider>
        <ConnectedSidebar onFeedDeleted={onFeedDeleted} />
      </FeedsProvider>,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();
    await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();
    deleteFeedRequestedHandler?.(feedA.id);
    await expect.element(getByRole('heading', { name: 'Delete feed' })).toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Delete feed' }).click();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('feeds:delete-feed', feedA.id);
    await expect.element(getByRole('heading', { name: 'Delete feed' })).not.toBeInTheDocument();
    await expect.element(getByText('Feed A', { exact: true })).not.toBeInTheDocument();
    await expect.element(getByText('Feed B', { exact: true })).toBeInTheDocument();
    expect(onFeedDeleted).toHaveBeenCalledWith(feedA);
  });

  test('a failed reply keeps the feed and shows the message', async () => {
    // Arrange
    stubElectron({ feeds: [feedA], deleteFeed: { success: false, error: { name: 'DB_ERROR', message: 'Could not delete the feed.' } } });
    const { getByText, getByRole } = await render(
      <FeedsProvider>
        <ConnectedSidebar onFeedDeleted={vi.fn()} />
      </FeedsProvider>,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();
    await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();
    deleteFeedRequestedHandler?.(feedA.id);

    // Act
    await getByRole('button', { name: 'Delete feed' }).click();

    // Assert
    await expect.element(getByText('Could not delete the feed.', { exact: true })).toBeInTheDocument();
    await expect.element(getByRole('heading', { name: 'Delete feed' })).toBeInTheDocument();
    await expect.element(getByText('1 item', { exact: true })).toBeInTheDocument();
  });
});

