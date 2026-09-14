import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useFeeds } from '@/providers/feeds-provider';
import { useIpcBridge } from '@/lib/ipc-bridge';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import RiverSidebar from './RiverSidebar';
import type { DeleteFeedError } from '../../../main/db/crud/delete';
import type { FeedSummary } from '../../../preload/channels';
import type { Result } from '../../../main/lib/utils';
import type { TwoWayRendererMainChannelPayloads, TwoWayRendererMainChannelsInvokeArgs } from '../../../preload/channels';

const feedA: FeedSummary = {
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
  itemCount: 1,
  unreadCount: 1,
};

const feedB: FeedSummary = {
  id: 2,
  link: 'https://b.example/feed',
  title: 'Feed B',
  category_id: 1,
  type: 'rss',
  showInHome: 1,
  last_fetched_at: undefined,
  last_error: undefined,
  icon: undefined,
  category: { id: 1, name: 'Tech' },
  itemCount: 0,
  unreadCount: 0,
};

let deleteFeedRequestedHandler: ((feedId: number) => void) | undefined;
let invokeMock: ReturnType<typeof vi.fn>;

function stubElectron(overrides: {
  feeds?: FeedSummary[];
  deleteFeed?: Result<void, DeleteFeedError>;
} = {}) {
  deleteFeedRequestedHandler = undefined;

  invokeMock = vi.fn(<C extends keyof TwoWayRendererMainChannelsInvokeArgs>(channel: C): Promise<TwoWayRendererMainChannelPayloads[C]> => {
    switch (channel) {
      case 'feeds:list':
        return Promise.resolve(overrides.feeds ?? []) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:delete-feed':
        return Promise.resolve(overrides.deleteFeed ?? { success: true, data: undefined }) as Promise<TwoWayRendererMainChannelPayloads[C]>;
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

function IpcBridgeMount() {
  useIpcBridge();
  return null;
}

function ConnectedSidebar({ onFeedDeleted }: { onFeedDeleted: (feed: FeedSummary) => void }) {
  const feeds = useFeeds();
  return (
    <>
      <IpcBridgeMount />
      <RiverSidebar feeds={feeds} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={onFeedDeleted} />
    </>
  );
}

beforeEach(() => {
  stubElectron();
  localStorage.clear();
});

test('clicking "Add feed" opens the add-feed modal', async () => {
  // Arrange
  const { getByRole } = await renderWithQueryClient(
    <RiverSidebar feeds={[]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
  );
  await expect.element(getByRole('heading', { name: 'Add a feed' })).not.toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Add feed' }).click();

  // Assert
  await expect.element(getByRole('heading', { name: 'Add a feed' })).toBeInTheDocument();
});

describe('feed row visibility rotation', () => {
  test('clicking a home feed row asks to show it only', async () => {
    // Arrange
    const onSetVisibility = vi.fn();
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
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
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set([feedA.link])} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Act
    await getByRole('button', { name: /Feed A/ }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA], 'hidden');
  });

  test('clicking a hidden feed row asks to show it with the others', async () => {
    // Arrange
    const hiddenFeedA: FeedSummary = { ...feedA, showInHome: 0 };
    const onSetVisibility = vi.fn();
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[hiddenFeedA]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Act
    await getByRole('button', { name: /Feed A/ }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([hiddenFeedA], 'home');
  });
});

describe('feed row current-state label', () => {
  test('a home feed is titled by what it is now, not the "only" state a click moves it to', async () => {
    // Arrange
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByRole('button', { name: /^Feed A/ })).toHaveAttribute('title', 'Feed A — Shown with others');
  });

  test('a soloed feed is titled "Shown only", not the "hidden" state it moves to next', async () => {
    // Arrange
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set([feedA.link])} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByRole('button', { name: /^Feed A/ })).toHaveAttribute('title', 'Feed A — Shown only');
  });

  test('a hidden feed is titled "Hidden", not the "home" state it moves to next', async () => {
    // Arrange
    const hiddenFeedA: FeedSummary = { ...feedA, showInHome: 0 };
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[hiddenFeedA]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByRole('button', { name: /^Feed A/ })).toHaveAttribute('title', 'Feed A — Hidden');
  });
});

describe('folder visibility rotation', () => {
  test('the rotate button applies the next state to every feed in the folder', async () => {
    // Arrange
    const onSetVisibility = vi.fn();
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA, feedB]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
    );

    // Act
    await getByRole('button', { name: 'Show only: Tech' }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA, feedB], 'only');
  });

  test('a mixed folder resets to home on the first click', async () => {
    // Arrange
    const hiddenFeedB: FeedSummary = { ...feedB, showInHome: 0 };
    const onSetVisibility = vi.fn();
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA, hiddenFeedB]} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
    );

    // Act
    await getByRole('button', { name: 'Show with others: Tech' }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA, hiddenFeedB], 'home');
  });

  test('the expand button still toggles the folder open and closed', async () => {
    // Arrange
    const { getByRole, getByText } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );
    await expect.element(getByText('Feed A', { exact: true })).not.toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();
  });
});

describe('unread counts', () => {
  test('feed and folder counts reflect FeedSummary.unreadCount', async () => {
    // Arrange
    const feedWithUnread: FeedSummary = { ...feedA, itemCount: 2, unreadCount: 1 };
    const { getByRole, getByTestId } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedWithUnread]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );

    // Act
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByTestId('folder-count')).toHaveTextContent('1');
    await expect.element(getByTestId('feed-count')).toHaveTextContent('1');
  });

  test('a fully-read feed and folder show a blank count instead of 0', async () => {
    // Arrange
    const fullyReadFeed: FeedSummary = { ...feedA, itemCount: 1, unreadCount: 0 };
    const { getByRole, getByTestId } = await renderWithQueryClient(
      <RiverSidebar feeds={[fullyReadFeed]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );

    // Act
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByTestId('folder-count')).toHaveTextContent('');
    await expect.element(getByTestId('feed-count')).toHaveTextContent('');
  });
});

describe('feed row context menu and delete', () => {
  test('right-clicking a feed row sends feeds:show-feed-context-menu with the feed id', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole, getByText } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
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
    const { getByText, getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
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
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    deleteFeedRequestedHandler?.(feedA.id);
    await expect.element(getByRole('heading', { name: 'Delete feed' })).toBeInTheDocument();
    invokeMock.mockClear();

    // Act
    await getByRole('button', { name: 'Cancel' }).click();

    // Assert
    await expect.element(getByRole('heading', { name: 'Delete feed' })).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith('feeds:delete-feed', expect.anything());
  });

  test('confirm invokes feeds:delete-feed with the feed id and calls onFeedDeleted', async () => {
    // Arrange
    stubElectron({ feeds: [feedA, feedB], deleteFeed: { success: true, data: undefined } });
    const onFeedDeleted = vi.fn();
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={onFeedDeleted} />);
    deleteFeedRequestedHandler?.(feedA.id);
    await expect.element(getByRole('heading', { name: 'Delete feed' })).toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Delete feed' }).click();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('feeds:delete-feed', feedA.id);
    await expect.element(getByRole('heading', { name: 'Delete feed' })).not.toBeInTheDocument();
    expect(onFeedDeleted).toHaveBeenCalledWith(feedA);
  });

  test('a failed reply keeps the dialog open and shows the message', async () => {
    // Arrange
    stubElectron({ feeds: [feedA], deleteFeed: { success: false, error: { name: 'DB_ERROR', message: 'Could not delete the feed.' } } });
    const { getByText, getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    deleteFeedRequestedHandler?.(feedA.id);

    // Act
    await getByRole('button', { name: 'Delete feed' }).click();

    // Assert
    await expect.element(getByText('Could not delete the feed.', { exact: true })).toBeInTheDocument();
    await expect.element(getByRole('heading', { name: 'Delete feed' })).toBeInTheDocument();
    await expect.element(getByText('1 item', { exact: true })).toBeInTheDocument();
  });
});
