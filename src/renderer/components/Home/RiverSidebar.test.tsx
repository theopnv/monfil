import { beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useCategories, useFeeds } from '@/providers/feeds-provider';
import { useIpcBridge } from '@/lib/ipc-bridge';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import RiverSidebar from './RiverSidebar';
import type { DeleteCategoryError } from '../../../main/db/crud/delete';
import type { DeleteFeedError } from '../../../main/db/crud/delete';
import type { CreateCategoryError } from '../../../main/db/crud/insert';
import type { UpdateCategoryError } from '../../../main/db/crud/update';
import { HOME_WORKSPACE_ID, type FeedCategory, type FeedSummary } from '../../../preload/channels';
import type { Result } from '../../../main/lib/utils';
import type { TwoWayRendererMainChannelPayloads, TwoWayRendererMainChannelsInvokeArgs } from '../../../preload/channels';

const feedA: FeedSummary = {
  id: 1,
  link: 'https://a.example/feed',
  title: 'Feed A',
  type: 'rss',
  showInWorkspace: 1,
  workspaceId: HOME_WORKSPACE_ID,
  last_fetched_at: undefined,
  last_error: undefined,
  icon: undefined,
  category: { id: 1, name: 'Tech', workspace_id: HOME_WORKSPACE_ID },
  itemCount: 1,
  unreadCount: 1,
};

const feedB: FeedSummary = {
  id: 2,
  link: 'https://b.example/feed',
  title: 'Feed B',
  type: 'rss',
  showInWorkspace: 1,
  workspaceId: HOME_WORKSPACE_ID,
  last_fetched_at: undefined,
  last_error: undefined,
  icon: undefined,
  category: { id: 1, name: 'Tech', workspace_id: HOME_WORKSPACE_ID },
  itemCount: 0,
  unreadCount: 0,
};

const feedC: FeedSummary = {
  id: 3,
  link: 'https://c.example/feed',
  title: 'Feed C',
  type: 'rss',
  showInWorkspace: 1,
  workspaceId: HOME_WORKSPACE_ID,
  last_fetched_at: undefined,
  last_error: undefined,
  icon: undefined,
  category: { id: 2, name: 'News', workspace_id: HOME_WORKSPACE_ID },
  itemCount: 0,
  unreadCount: 0,
};

// The category every feed in `feeds` belongs to — mirrors what `feeds:list-categories` would
// return for a database that never got an empty category created ahead of any feed.
function categoriesFrom(feeds: FeedSummary[]): FeedCategory[] {
  const seen = new Map<number, FeedCategory>();
  for (const feed of feeds) {
    seen.set(feed.category.id, feed.category);
  }
  return [...seen.values()];
}

let deleteFeedRequestedHandler: ((feedId: number) => void) | undefined;
let renameCategoryRequestedHandler: ((categoryId: number) => void) | undefined;
let deleteCategoryRequestedHandler: ((categoryId: number) => void) | undefined;
let invokeMock: ReturnType<typeof vi.fn>;

function stubElectron(overrides: {
  feeds?: FeedSummary[];
  categories?: FeedCategory[];
  deleteFeed?: Result<void, DeleteFeedError>;
  createCategory?: Result<FeedCategory, CreateCategoryError>;
  renameCategory?: Result<FeedCategory, UpdateCategoryError>;
  deleteCategory?: Result<void, DeleteCategoryError>;
  moveFeedsToCategory?: Result<void, UpdateCategoryError>;
} = {}) {
  deleteFeedRequestedHandler = undefined;
  renameCategoryRequestedHandler = undefined;
  deleteCategoryRequestedHandler = undefined;

  // Mutated by create/rename/delete below, so a test asserting the sidebar reflects a mutation
  // (e.g. a deleted folder actually disappearing) sees `feeds:list-categories` catch up, the same
  // way the real main process would.
  let currentCategories = overrides.categories ?? categoriesFrom(overrides.feeds ?? []);

  invokeMock = vi.fn(<C extends keyof TwoWayRendererMainChannelsInvokeArgs>(channel: C, arg: TwoWayRendererMainChannelsInvokeArgs[C]): Promise<TwoWayRendererMainChannelPayloads[C]> => {
    switch (channel) {
      case 'feeds:list':
        return Promise.resolve(overrides.feeds ?? []) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:list-categories':
        return Promise.resolve(currentCategories) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:delete-feed':
        return Promise.resolve(overrides.deleteFeed ?? { success: true, data: undefined }) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      case 'feeds:create-category': {
        const result = overrides.createCategory ?? { success: true, data: { id: 99, name: (arg as { name: string }).name, workspace_id: HOME_WORKSPACE_ID } };
        if (result.success) {
          currentCategories = [...currentCategories, result.data];
        }
        return Promise.resolve(result) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      }
      case 'feeds:rename-category': {
        const result = overrides.renameCategory ?? { success: true, data: { id: 1, name: 'Renamed', workspace_id: HOME_WORKSPACE_ID } };
        if (result.success) {
          currentCategories = currentCategories.map((category) => (category.id === result.data.id ? result.data : category));
        }
        return Promise.resolve(result) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      }
      case 'feeds:delete-category': {
        const result = overrides.deleteCategory ?? { success: true, data: undefined };
        if (result.success) {
          currentCategories = currentCategories.filter((category) => category.id !== (arg as { categoryId: number }).categoryId);
        }
        return Promise.resolve(result) as Promise<TwoWayRendererMainChannelPayloads[C]>;
      }
      case 'feeds:move-feeds-to-category':
        return Promise.resolve(overrides.moveFeedsToCategory ?? { success: true, data: undefined }) as Promise<TwoWayRendererMainChannelPayloads[C]>;
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
        if (channel === 'feeds:rename-category-requested') {
          renameCategoryRequestedHandler = handler as typeof renameCategoryRequestedHandler;
        }
        if (channel === 'feeds:delete-category-requested') {
          deleteCategoryRequestedHandler = handler as typeof deleteCategoryRequestedHandler;
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
  const categories = useCategories();
  return (
    <>
      <IpcBridgeMount />
      <RiverSidebar feeds={feeds} categories={categories} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={onFeedDeleted} />
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
    <RiverSidebar feeds={[]} categories={[]} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
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
      <RiverSidebar feeds={[feedA]} categories={categoriesFrom([feedA])} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
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
      <RiverSidebar feeds={[feedA]} categories={categoriesFrom([feedA])} showOnlyLinks={new Set([feedA.link])} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Act
    await getByRole('button', { name: /Feed A/ }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA], 'hidden');
  });

  test('clicking a hidden feed row asks to show it with the others', async () => {
    // Arrange
    const hiddenFeedA: FeedSummary = { ...feedA, showInWorkspace: 0 };
    const onSetVisibility = vi.fn();
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[hiddenFeedA]} categories={categoriesFrom([hiddenFeedA])} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
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
      <RiverSidebar feeds={[feedA]} categories={categoriesFrom([feedA])} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByRole('button', { name: /^Feed A/ })).toHaveAttribute('title', 'Feed A — Shown with others');
  });

  test('a soloed feed is titled "Shown only", not the "hidden" state it moves to next', async () => {
    // Arrange
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA]} categories={categoriesFrom([feedA])} showOnlyLinks={new Set([feedA.link])} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
    );
    await getByRole('button', { name: 'Tech', exact: true }).click();

    // Assert
    await expect.element(getByRole('button', { name: /^Feed A/ })).toHaveAttribute('title', 'Feed A — Shown only');
  });

  test('a hidden feed is titled "Hidden", not the "home" state it moves to next', async () => {
    // Arrange
    const hiddenFeedA: FeedSummary = { ...feedA, showInWorkspace: 0 };
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[hiddenFeedA]} categories={categoriesFrom([hiddenFeedA])} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
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
      <RiverSidebar feeds={[feedA, feedB]} categories={categoriesFrom([feedA, feedB])} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
    );

    // Act
    await getByRole('button', { name: 'Show only: Tech' }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA, feedB], 'only');
  });

  test('a mixed folder resets to home on the first click', async () => {
    // Arrange
    const hiddenFeedB: FeedSummary = { ...feedB, showInWorkspace: 0 };
    const onSetVisibility = vi.fn();
    const { getByRole } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA, hiddenFeedB]} categories={categoriesFrom([feedA, hiddenFeedB])} showOnlyLinks={new Set()} onSetVisibility={onSetVisibility} onFeedDeleted={vi.fn()} />,
    );

    // Act
    await getByRole('button', { name: 'Show with others: Tech' }).click();

    // Assert
    expect(onSetVisibility).toHaveBeenCalledWith([feedA, hiddenFeedB], 'home');
  });

  test('the expand button still toggles the folder open and closed', async () => {
    // Arrange
    const { getByRole, getByText } = await renderWithQueryClient(
      <RiverSidebar feeds={[feedA]} categories={categoriesFrom([feedA])} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
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
      <RiverSidebar feeds={[feedWithUnread]} categories={categoriesFrom([feedWithUnread])} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
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
      <RiverSidebar feeds={[fullyReadFeed]} categories={categoriesFrom([fullyReadFeed])} showOnlyLinks={new Set()} onSetVisibility={vi.fn()} onFeedDeleted={vi.fn()} />,
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

describe('folder context menu and rename', () => {
  test('right-clicking a folder header sends feeds:show-category-context-menu with the category id', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);

    // Act
    await getByRole('button', { name: 'Tech', exact: true }).click({ button: 'right' });

    // Assert
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('feeds:show-category-context-menu', feedA.category.id);
  });

  test('firing feeds:rename-category-requested swaps the label for an editable field', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await expect.element(getByRole('textbox')).not.toBeInTheDocument();

    // Act
    renameCategoryRequestedHandler?.(feedA.category.id);

    // Assert
    await expect.element(getByRole('textbox')).toHaveValue('Tech');
  });

  test('typing into the field updates its value', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    renameCategoryRequestedHandler?.(feedA.category.id);
    await expect.element(getByRole('textbox')).toHaveValue('Tech');

    // Act
    await getByRole('textbox').click();
    await userEvent.keyboard('X');

    // Assert
    await expect.element(getByRole('textbox')).toHaveValue('TechX');
  });

  // A letter matching another row's own first letter used to be swallowed by GridList's keyboard
  // typeahead (which also lives on 't', 's', ... depending on what's in the collection) instead of
  // reaching the input: see doc/frontend.md's React Aria collections note.
  test('typing a letter that matches a folder name does not get swallowed', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    renameCategoryRequestedHandler?.(feedA.category.id);
    await expect.element(getByRole('textbox')).toHaveValue('Tech');

    // Act
    await getByRole('textbox').click();
    await userEvent.keyboard('t');

    // Assert
    await expect.element(getByRole('textbox')).toHaveValue('Techt');
  });

  // The rename field used to close itself before any keystroke on every folder but the first one:
  // the GridList claimed its first row as focus entered the collection and pulled DOM focus onto
  // it, blurring the field.
  test('a folder other than the first one can be renamed', async () => {
    // Arrange
    stubElectron({ feeds: [feedA, feedC] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await expect.element(getByRole('button', { name: 'News', exact: true })).toBeInTheDocument();

    // Act
    renameCategoryRequestedHandler?.(feedC.category.id);
    await expect.element(getByRole('textbox')).toHaveValue('News');
    await getByRole('textbox').fill('Politics');
    await userEvent.keyboard('{Enter}');

    // Assert
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('feeds:rename-category', { categoryId: feedC.category.id, name: 'Politics' });
    });
  });

  test('an empty folder can be renamed', async () => {
    // Arrange
    const empty: FeedCategory = { id: 5, name: 'Recipes', workspace_id: HOME_WORKSPACE_ID };
    stubElectron({ feeds: [feedA], categories: [feedA.category, empty] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    // Waits for the categories query to resolve — a right-click on this row (what the request
    // handler stands in for) couldn't fire any sooner than this in the real app either.
    await expect.element(getByRole('button', { name: 'Recipes', exact: true })).toBeInTheDocument();

    // Act
    renameCategoryRequestedHandler?.(empty.id);
    await expect.element(getByRole('textbox')).toHaveValue('Recipes');
    await getByRole('textbox').fill('Meals');
    await userEvent.keyboard('{Enter}');

    // Assert
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('feeds:rename-category', { categoryId: empty.id, name: 'Meals' });
    });
  });

  test('pressing Enter submits the new name via feeds:rename-category', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    renameCategoryRequestedHandler?.(feedA.category.id);
    await getByRole('textbox').fill('Engineering');

    // Act
    await userEvent.keyboard('{Enter}');

    // Assert
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('feeds:rename-category', { categoryId: feedA.category.id, name: 'Engineering' });
    });
    await expect.element(getByRole('textbox')).not.toBeInTheDocument();
  });

  test('pressing Escape cancels without invoking anything', async () => {
    // Arrange
    stubElectron({ feeds: [feedA] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    renameCategoryRequestedHandler?.(feedA.category.id);
    await getByRole('textbox').fill('Engineering');
    invokeMock.mockClear();

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    await expect.element(getByRole('textbox')).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith('feeds:rename-category', expect.anything());
  });

  test('a duplicate name reply keeps the field open and shows the message', async () => {
    // Arrange
    stubElectron({ feeds: [feedA], renameCategory: { success: false, error: { name: 'DUPLICATE_NAME', message: 'nope' } } });
    const { getByRole, getByText } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    renameCategoryRequestedHandler?.(feedA.category.id);
    await getByRole('textbox').fill('Engineering');

    // Act
    await userEvent.keyboard('{Enter}');

    // Assert
    await expect.element(getByText('A folder with that name already exists.', { exact: true })).toBeInTheDocument();
    await expect.element(getByRole('textbox')).toBeInTheDocument();
  });
});

describe('folder create', () => {
  test('clicking "New folder" opens an editable field', async () => {
    // Arrange
    stubElectron();
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await expect.element(getByRole('textbox')).not.toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'New folder' }).click();

    // Assert
    await expect.element(getByRole('textbox', { name: 'New folder name' })).toHaveValue('');
  });

  test('pressing Enter submits the name via feeds:create-category', async () => {
    // Arrange
    stubElectron({ createCategory: { success: true, data: { id: 5, name: 'Recipes', workspace_id: HOME_WORKSPACE_ID } } });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await getByRole('button', { name: 'New folder' }).click();
    await getByRole('textbox', { name: 'New folder name' }).fill('Recipes');

    // Act
    await userEvent.keyboard('{Enter}');

    // Assert
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('feeds:create-category', { name: 'Recipes' });
    });
    await expect.element(getByRole('textbox', { name: 'New folder name' })).not.toBeInTheDocument();
  });

  test('the new folder appears in the sidebar with no feeds in it', async () => {
    // Arrange
    stubElectron({ feeds: [feedA], categories: [feedA.category, { id: 5, name: 'Recipes', workspace_id: HOME_WORKSPACE_ID }] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);

    // Assert
    await expect.element(getByRole('button', { name: 'Recipes', exact: true })).toBeInTheDocument();
    await getByRole('button', { name: 'Recipes', exact: true }).click();
    await expect.element(getByRole('row', { name: 'Recipes' }).getByTestId('folder-count')).toHaveTextContent('');
  });

  test('pressing Escape cancels without invoking anything', async () => {
    // Arrange
    stubElectron();
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await getByRole('button', { name: 'New folder' }).click();
    await getByRole('textbox', { name: 'New folder name' }).fill('Recipes');
    invokeMock.mockClear();

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    await expect.element(getByRole('textbox', { name: 'New folder name' })).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith('feeds:create-category', expect.anything());
  });

  test('a duplicate name reply keeps the field open and shows the message', async () => {
    // Arrange
    stubElectron({ createCategory: { success: false, error: { name: 'DUPLICATE_NAME', message: 'nope' } } });
    const { getByRole, getByText } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await getByRole('button', { name: 'New folder' }).click();
    await getByRole('textbox', { name: 'New folder name' }).fill('Tech');

    // Act
    await userEvent.keyboard('{Enter}');

    // Assert
    await expect.element(getByText('A folder with that name already exists.', { exact: true })).toBeInTheDocument();
    await expect.element(getByRole('textbox', { name: 'New folder name' })).toBeInTheDocument();
  });
});

describe('folder delete', () => {
  test('firing feeds:delete-category-requested opens the dialog naming the folder and its feed count', async () => {
    // Arrange
    stubElectron({ feeds: [feedA, feedB] });
    const { getByRole, getByText } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await expect.element(getByRole('heading', { name: 'Delete folder' })).not.toBeInTheDocument();

    // Act
    deleteCategoryRequestedHandler?.(feedA.category.id);

    // Assert
    await expect.element(getByRole('heading', { name: 'Delete folder' })).toBeInTheDocument();
    await expect.element(getByRole('dialog').getByText('Tech', { exact: true })).toBeInTheDocument();
    await expect.element(getByText('2 feeds', { exact: true })).toBeInTheDocument();
  });

  test('confirm invokes feeds:delete-category with the chosen destination', async () => {
    // Arrange
    stubElectron({ feeds: [feedA, feedC] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    deleteCategoryRequestedHandler?.(feedA.category.id);
    await expect.element(getByRole('heading', { name: 'Delete folder' })).toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Delete folder' }).click();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('feeds:delete-category', { categoryId: feedA.category.id, reassignTo: feedC.category.id });
    await expect.element(getByRole('heading', { name: 'Delete folder' })).not.toBeInTheDocument();
  });

  test('with no other folder to move feeds into, the confirm button is disabled', async () => {
    // Arrange
    stubElectron({ feeds: [feedA, feedB] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    deleteCategoryRequestedHandler?.(feedA.category.id);
    await expect.element(getByRole('heading', { name: 'Delete folder' })).toBeInTheDocument();

    // Assert
    await expect.element(getByRole('button', { name: 'Delete folder' })).toBeDisabled();
  });

  // A category with no feeds in it isn't findable through any feed's `.category` — the dialog's
  // request handler must look it up in `categories` instead, or it silently does nothing.
  test('firing feeds:delete-category-requested opens the dialog for a folder with no feeds in it', async () => {
    // Arrange
    const empty: FeedCategory = { id: 5, name: 'Recipes', workspace_id: HOME_WORKSPACE_ID };
    stubElectron({ feeds: [feedA], categories: [feedA.category, empty] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);

    // Act
    deleteCategoryRequestedHandler?.(empty.id);

    // Assert
    await expect.element(getByRole('heading', { name: 'Delete folder' })).toBeInTheDocument();
    await expect.element(getByRole('dialog').getByText('Recipes', { exact: true })).toBeInTheDocument();
  });

  test('confirm removes an empty folder from the sidebar', async () => {
    // Arrange
    const empty: FeedCategory = { id: 5, name: 'Recipes', workspace_id: HOME_WORKSPACE_ID };
    stubElectron({ feeds: [feedA], categories: [feedA.category, empty], deleteCategory: { success: true, data: undefined } });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    deleteCategoryRequestedHandler?.(empty.id);
    await expect.element(getByRole('heading', { name: 'Delete folder' })).toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Delete folder' }).click();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('feeds:delete-category', { categoryId: empty.id, reassignTo: feedA.category.id });
    await expect.element(getByRole('button', { name: 'Recipes', exact: true })).not.toBeInTheDocument();
  });
});

describe('drag and drop moves a feed into a folder', () => {
  // Skipped: react-aria's drag-and-drop is pointer-driven, not native HTML5 DnD, and neither
  // Playwright's native `dragAndDrop` nor a click/Enter "virtual drag" sequence reliably drives it
  // in this harness (both leave `feeds:move-feeds-to-category` uncalled). The underlying
  // `moveFeedsToCategory` crud function and the `onItemDrop` wiring are still covered: the former by
  // `src/main/db/crud/update.test.ts`, the latter by `test/e2e/categories.spec.ts`, which drives the
  // same gesture with raw stepped mouse primitives against the packaged app.
  test.skip('dropping a feed onto another folder invokes feeds:move-feeds-to-category', async () => {
    // Arrange
    stubElectron({ feeds: [feedA, feedC] });
    const { getByRole } = await renderWithQueryClient(<ConnectedSidebar onFeedDeleted={vi.fn()} />);
    await getByRole('button', { name: 'Tech', exact: true }).click();
    const dragHandle = getByRole('button', { name: 'Drag to a folder' });
    const newsFolder = getByRole('button', { name: 'News', exact: true });

    // Act
    await dragHandle.dropTo(newsFolder);

    // Assert
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('feeds:move-feeds-to-category', { feedIds: [feedA.id], categoryId: feedC.category.id });
    });
  });
});
