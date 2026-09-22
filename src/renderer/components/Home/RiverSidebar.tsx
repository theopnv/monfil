import { useEffect, useMemo, useState } from "react";
import { ipc } from '@/lib/ipc-client';
import { ChevronRight, DotsGrid, FolderPlus, LayersTwo01, Plus } from "@untitledui/icons";
import { Button as DragHandleButton, GridList, GridListItem, useDragAndDrop } from "react-aria-components";
import AddFeedModal from "@/components/AddFeed/AddFeedModal";
import DeleteCategoryDialog from "@/components/Home/DeleteCategoryDialog";
import DeleteFeedDialog from "@/components/Home/DeleteFeedDialog";
import FeedAvatar from "@/components/Home/FeedAvatar";
import FeedpackInstallDialog from '@/components/Feedpacks/FeedpackInstallDialog';
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { cx } from "@/components/untitled-ui/utils/cx";
import { categoryErrorMessage } from "@/lib/river/category-errors";
import { feedVisibility, folderVisibility, nextVisibility, VISIBILITY_ICON, VISIBILITY_LABEL, VISIBILITY_STATE_LABEL, type FeedVisibility } from "@/lib/river/feed-visibility";
import {
  useClearDeleteCategoryRequest,
  useClearDeleteFeedRequest,
  useClearRenameCategoryRequest,
  useDeleteCategoryRequestedId,
  useDeleteFeedRequestedId,
  useRenameCategoryRequestedId,
} from "@/lib/ipc-bridge";
import { resolveFeedIcon } from "@/lib/favicon";
import { readLocalStorageJSON, writeLocalStorageJSON } from "@/lib/local-storage";
import { useCreateCategory, useMoveFeeds, useRenameCategory } from "@/providers/feeds-provider";
import { useActiveWorkspaceId } from '@/providers/workspace-provider';
import type { FeedCategory, FeedSummary } from "../../../shared/contracts";

export interface RiverSidebarProps {
  feeds: FeedSummary[];
  categories: FeedCategory[];
  showOnlyLinks: ReadonlySet<string>;
  onSetVisibility: (feeds: FeedSummary[], target: FeedVisibility) => void;
  onFeedDeleted: (feed: FeedSummary) => void;
}

interface Folder {
  id: number;
  name: string;
  feeds: FeedSummary[];
  count: number;
  open: boolean;
}

const OPEN_FOLDERS_STORAGE_KEY = 'sidebar-open-folders';
// A custom MIME-like type keeps the drag payload from being accepted by anything but this sidebar.
const FEED_DRAG_TYPE = 'application/x-monfil-feed';
const FOLDER_KEY_PREFIX = 'folder:';
const FEED_KEY_PREFIX = 'feed:';
// Folder and feed counts share a right edge, so a column of them reads as one vertical line.
const COUNT_CLASSES = 'w-6 flex-none text-right text-xs text-tertiary tabular-nums';

function loadOpenFolderIds(): Set<number> {
  const parsed = readLocalStorageJSON(OPEN_FOLDERS_STORAGE_KEY);
  return new Set(Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []);
}

// Flips a single id in the stored set, rather than replacing it with the currently mounted
// folders: those only cover one workspace at a time, and replacing wholesale would drop every
// other workspace's open folders from storage.
function setFolderOpenStored(id: number, open: boolean): void {
  const ids = loadOpenFolderIds();
  if (open) {
    ids.add(id);
  } else {
    ids.delete(id);
  }
  writeLocalStorageJSON(OPEN_FOLDERS_STORAGE_KEY, [...ids]);
}

// Seeded from `categories` first so a category with no feeds yet still gets a row; a feed whose
// category isn't in that list (a race between the two queries) still gets a fallback one.
// Keyed by category id, not name: a category's id is unique across every workspace, but its name
// is only unique within its own workspace, so two workspaces can each have a "Tech" folder.
function groupByCategory(categories: FeedCategory[], feeds: FeedSummary[]): Folder[] {
  const openFolderIds = loadOpenFolderIds();
  const folders = new Map<number, Folder>();
  for (const category of categories) {
    folders.set(category.id, { id: category.id, name: category.name, feeds: [], count: 0, open: openFolderIds.has(category.id) });
  }
  for (const feed of feeds) {
    const { id, name } = feed.category;
    const folder = folders.get(id) ?? { id, name, feeds: [], count: 0, open: openFolderIds.has(id) };
    folder.feeds.push(feed);
    folder.count += feed.unreadCount;
    folders.set(id, folder);
  }
  return [...folders.values()];
}

// A folder header and its feed rows are flattened into one collection so a feed row can be
// dragged and dropped "on" a folder row within a single GridList.
type SidebarItem =
  | { type: 'folder'; key: string; folder: Folder }
  | { type: 'feed'; key: string; feed: FeedSummary };

function toSidebarItems(folders: Folder[]): SidebarItem[] {
  return folders.flatMap((folder): SidebarItem[] => [
    { type: 'folder', key: `${FOLDER_KEY_PREFIX}${folder.id}`, folder },
    ...(folder.open
      ? folder.feeds.map((feed): SidebarItem => ({ type: 'feed', key: `${FEED_KEY_PREFIX}${feed.id}`, feed }))
      : []),
  ]);
}

/**
 * The folder a drop on `key` belongs to. A feed row answers with its own folder, so the whole
 * category area accepts a drop, not just its header.
 *
 * @return the category id, or null when the key is not part of a folder.
 */
function dropCategoryId(items: SidebarItem[], key: string): number | null {
  if (key.startsWith(FOLDER_KEY_PREFIX)) {
    return Number(key.slice(FOLDER_KEY_PREFIX.length));
  }
  const item = items.find((entry) => entry.key === key);
  return item?.type === 'feed' ? item.feed.category.id : null;
}

export default function RiverSidebar({ feeds, categories, showOnlyLinks, onSetVisibility, onFeedDeleted }: RiverSidebarProps) {
  const activeWorkspaceId = useActiveWorkspaceId();
  const [folders, setFolders] = useState(() => groupByCategory(categories, feeds));
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [isFeedpackBrowserOpen, setIsFeedpackBrowserOpen] = useState(false);
  const [feedPendingDelete, setFeedPendingDelete] = useState<FeedSummary | null>(null);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<FeedCategory | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [dropCategoryTarget, setDropCategoryTarget] = useState<number | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);

  const deleteFeedRequestedId = useDeleteFeedRequestedId();
  const clearDeleteFeedRequest = useClearDeleteFeedRequest();
  const renameCategoryRequestedId = useRenameCategoryRequestedId();
  const clearRenameCategoryRequest = useClearRenameCategoryRequest();
  const deleteCategoryRequestedId = useDeleteCategoryRequestedId();
  const clearDeleteCategoryRequest = useClearDeleteCategoryRequest();

  const createCategory = useCreateCategory();
  const renameCategory = useRenameCategory();
  const moveFeeds = useMoveFeeds();

  useEffect(() => {
    setFolders((prev) => {
      const openById = new Map(prev.map((folder) => [folder.id, folder.open]));
      return groupByCategory(categories, feeds).map((folder) => ({ ...folder, open: openById.get(folder.id) ?? folder.open }));
    });
  }, [categories, feeds]);

  useEffect(() => {
    if (deleteFeedRequestedId === null) {
      return;
    }
    setFeedPendingDelete((prev) => feeds.find((feed) => feed.id === deleteFeedRequestedId) ?? prev);
    clearDeleteFeedRequest();
  }, [deleteFeedRequestedId, feeds, clearDeleteFeedRequest]);

  useEffect(() => {
    if (renameCategoryRequestedId === null) {
      return;
    }
    const category = categories.find((entry) => entry.id === renameCategoryRequestedId);
    if (category) {
      setEditingCategoryId(category.id);
      setEditingName(category.name);
      setRenameError(null);
    }
    clearRenameCategoryRequest();
  }, [renameCategoryRequestedId, categories, clearRenameCategoryRequest]);

  useEffect(() => {
    if (deleteCategoryRequestedId === null) {
      return;
    }
    const category = categories.find((entry) => entry.id === deleteCategoryRequestedId);
    if (category) {
      setCategoryPendingDelete(category);
    }
    clearDeleteCategoryRequest();
  }, [deleteCategoryRequestedId, categories, clearDeleteCategoryRequest]);

  const items = useMemo(() => toSidebarItems(folders), [folders]);

  // Takes the DOM value directly rather than reading `editingName` from the closure: a keydown
  // fired right after a fast edit can otherwise still be bound to the pre-edit render.
  async function submitRename(value: string) {
    if (editingCategoryId === null) {
      return;
    }
    const name = value.trim();
    const currentName = categories.find((entry) => entry.id === editingCategoryId)?.name;
    if (!name || currentName === undefined || name === currentName) {
      setEditingCategoryId(null);
      setRenameError(null);
      return;
    }

    const result = await renameCategory(editingCategoryId, name);
    if (result.success) {
      setEditingCategoryId(null);
      setRenameError(null);
    } else {
      setRenameError(categoryErrorMessage(result.error));
    }
  }

  function cancelRename() {
    setEditingCategoryId(null);
    setRenameError(null);
  }

  function startCreatingFolder() {
    setIsCreatingFolder(true);
    setNewFolderName('');
    setCreateFolderError(null);
  }

  function cancelCreatingFolder() {
    setIsCreatingFolder(false);
    setNewFolderName('');
    setCreateFolderError(null);
  }

  // Mirrors submitRename: takes the DOM value directly, and guards on `isCreatingFolder` so a blur
  // that fires as the input unmounts after a successful submit (or after Escape) is a harmless no-op.
  async function submitNewFolder(value: string) {
    if (!isCreatingFolder) {
      return;
    }
    const name = value.trim();
    if (!name) {
      cancelCreatingFolder();
      return;
    }

    const result = await createCategory(name);
    if (result.success) {
      cancelCreatingFolder();
    } else {
      setCreateFolderError(categoryErrorMessage(result.error));
    }
  }

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].flatMap((key) => {
      const item = items.find((entry) => entry.key === key);
      return item?.type === 'feed' ? [{ [FEED_DRAG_TYPE]: String(item.feed.id) }] : [];
    }),
    shouldAcceptItemDrop: (target) => dropCategoryId(items, target.key.toString()) !== null,
    getDropOperation: (target) => (
      target.type === 'item' && target.dropPosition === 'on' && dropCategoryId(items, target.key.toString()) !== null
        ? 'move'
        : 'cancel'
    ),
    onDropEnter: (event) => {
      setDropCategoryTarget(event.target.type === 'item' ? dropCategoryId(items, event.target.key.toString()) : null);
    },
    onDropExit: () => setDropCategoryTarget(null),
    onDragEnd: () => setDropCategoryTarget(null),
    onItemDrop: async (event) => {
      setDropCategoryTarget(null);
      const categoryId = dropCategoryId(items, event.target.key.toString());
      if (categoryId === null) {
        return;
      }
      const feedIds: number[] = [];
      for (const dropItem of event.items) {
        if (dropItem.kind === 'text' && dropItem.types.has(FEED_DRAG_TYPE)) {
          const feedId = Number(await dropItem.getText(FEED_DRAG_TYPE));
          if (feeds.find((feed) => feed.id === feedId)?.category.id !== categoryId) {
            feedIds.push(feedId);
          }
        }
      }
      if (feedIds.length > 0) {
        await moveFeeds(feedIds, categoryId);
      }
    },
  });

  const categoryPendingDeleteFolder = categoryPendingDelete ? folders.find((entry) => entry.id === categoryPendingDelete.id) : undefined;
  const otherCategories: FeedCategory[] = categoryPendingDelete
    ? folders.filter((folder) => folder.id !== categoryPendingDelete.id).map((folder) => ({ id: folder.id, name: folder.name, workspace_id: categoryPendingDelete.workspace_id }))
    : [];

  return (
    <div className="flex h-full w-64 flex-none flex-col gap-1.5 overflow-y-auto border-r border-secondary bg-[color-mix(in_srgb,var(--color-bg-secondary)_45%,var(--color-bg-primary))] py-3">
      <div className="flex items-center justify-between px-4.5 pb-2">
        <span className="text-xs font-bold tracking-wide text-tertiary uppercase">Feeds</span>
        <div className="flex items-center gap-1">
          <Button aria-label="New folder" size="xs" color="tertiary" iconLeading={FolderPlus} onPress={startCreatingFolder} />
          <Button aria-label="Add feed" size="xs" color="tertiary" iconLeading={Plus} onPress={() => setIsAddFeedOpen(true)} />
          <Button aria-label="Add feedpack" size="xs" color="tertiary" iconLeading={LayersTwo01} onPress={() => setIsFeedpackBrowserOpen(true)} />
        </div>
      </div>
      {isCreatingFolder && (
        <div className="px-2.5">
          <div className="flex items-center gap-1.5 rounded-xl px-2.25 py-1.75 text-sm font-semibold text-primary">
            <input
              autoFocus
              aria-label="New folder name"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void submitNewFolder(event.currentTarget.value);
                } else if (event.key === 'Escape') {
                  cancelCreatingFolder();
                }
              }}
              onBlur={(event) => void submitNewFolder(event.currentTarget.value)}
              className="min-w-0 flex-1 rounded-md border border-secondary bg-primary px-1.5 py-0.5 text-sm text-primary outline-none"
            />
            {createFolderError && <span className="text-xs text-error-primary">{createFolderError}</span>}
          </div>
        </div>
      )}
      <AddFeedModal isOpen={isAddFeedOpen} onOpenChange={setIsAddFeedOpen} />
      <FeedpackInstallDialog isOpen={isFeedpackBrowserOpen} onOpenChange={setIsFeedpackBrowserOpen} workspaceId={activeWorkspaceId} />
      <DeleteFeedDialog
        feed={feedPendingDelete}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setFeedPendingDelete(null);
          }
        }}
        onDeleted={onFeedDeleted}
      />
      <DeleteCategoryDialog
        category={categoryPendingDelete}
        feedCount={categoryPendingDeleteFolder?.feeds.length ?? 0}
        otherCategories={otherCategories}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setCategoryPendingDelete(null);
          }
        }}
        onDeleted={() => setCategoryPendingDelete(null)}
      />
      <GridList
        aria-label="Feeds"
        items={items}
        selectionMode="none"
        // Typeahead would otherwise intercept keystrokes typed into the folder rename field
        // whenever they matched another row's leading letters, swallowing the keystroke and
        // shifting focus away from the input.
        disallowTypeAhead
        dragAndDropHooks={dragAndDropHooks}
        dependencies={[showOnlyLinks, editingCategoryId, editingName, renameError, dropCategoryTarget]}
        className="flex flex-col gap-px px-2.5 outline-none"
      >
        {(item) => {
          if (item.type === 'folder') {
            const { folder } = item;
            const folderState = folderVisibility(folder.feeds, showOnlyLinks);
            const folderNext = nextVisibility(folderState);
            const FolderNextIcon = VISIBILITY_ICON[folderNext];
            const isEditing = editingCategoryId === folder.id;
            const isDropTarget = dropCategoryTarget === folder.id;

            return (
              <GridListItem key={item.key} id={item.key} textValue={folder.name} focusMode={isEditing ? 'child' : 'row'} className="min-w-0 outline-none">
                <div
                  onContextMenu={(event) => {
                    event.preventDefault();
                    ipc.send('feeds:show-category-context-menu', folder.id);
                  }}
                  className={cx(
                    "group flex w-full items-center gap-1.5 rounded-xl px-2.25 py-1.75 text-sm font-semibold hover:bg-primary_hover",
                    folderState === "hidden" ? "text-quaternary opacity-60" : "text-primary",
                    isDropTarget && "bg-primary_hover ring-2 ring-inset ring-brand",
                  )}
                >
                  {/* Folders never drag (getItems returns nothing for a folder key); this satisfies react-aria's requirement that every item in a draggable collection expose a drag handle. */}
                  <DragHandleButton slot="drag" aria-label="Drag" className="hidden" />
                  {isEditing ? (
                    <input
                      autoFocus
                      aria-label={`Rename ${folder.name}`}
                      value={editingName}
                      // A GridList with no focused key yet claims its first row when focus enters
                      // it, then pulls DOM focus onto that row — which blurs this input and submits
                      // the rename for any folder but the first one.
                      onFocus={(event) => event.stopPropagation()}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void submitRename(event.currentTarget.value);
                        } else if (event.key === 'Escape') {
                          cancelRename();
                        }
                      }}
                      onBlur={(event) => void submitRename(event.currentTarget.value)}
                      className="min-w-0 flex-1 rounded-md border border-secondary bg-primary px-1.5 py-0.5 text-sm text-primary outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFolderOpenStored(folder.id, !folder.open);
                        setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, open: !f.open } : f)));
                      }}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <ChevronRight className={cx("size-3.25 flex-none text-quaternary transition-transform", folder.open && "rotate-90")} />
                      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      aria-label={`${VISIBILITY_LABEL[folderNext]}: ${folder.name}`}
                      onClick={() => onSetVisibility(folder.feeds, folderNext)}
                      className="flex-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <FolderNextIcon aria-hidden className="size-3.5 text-quaternary" />
                    </button>
                  )}
                  {isEditing && renameError ? (
                    <span className="text-xs text-error-primary">{renameError}</span>
                  ) : (
                    <span data-testid="folder-count" className={cx(COUNT_CLASSES, "font-bold")}>{folder.count > 0 ? folder.count : ''}</span>
                  )}
                </div>
              </GridListItem>
            );
          }

          const { feed } = item;
          const state = feedVisibility(feed, showOnlyLinks);
          const next = nextVisibility(state);
          const NextIcon = VISIBILITY_ICON[next];

          return (
            <GridListItem key={item.key} id={item.key} textValue={feed.title} className="min-w-0 outline-none">
              <div className={cx("group/row flex min-w-0 items-center rounded-xl pl-2", dropCategoryTarget === feed.category.id && "bg-primary_hover")}>
                <DragHandleButton
                  slot="drag"
                  aria-label="Drag to a folder"
                  className="flex-none cursor-grab px-0.5 text-quaternary opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                >
                  <DotsGrid aria-hidden className="size-3.5" />
                </DragHandleButton>
                <button
                  type="button"
                  title={`${feed.title} — ${VISIBILITY_STATE_LABEL[state]}`}
                  aria-label={`${feed.title}, ${VISIBILITY_STATE_LABEL[state]}${feed.unreadCount > 0 ? `, ${feed.unreadCount} unread` : ''}`}
                  data-visibility={state}
                  onClick={() => onSetVisibility([feed], next)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    ipc.send('feeds:show-feed-context-menu', feed.id);
                  }}
                  className={cx(
                    "group flex min-w-0 flex-1 items-center gap-2.25 rounded-xl px-2.25 py-1.5 text-left text-sm hover:bg-primary_hover",
                    state === "only" && "bg-primary_hover font-semibold text-primary",
                    state === "hidden" && "text-quaternary opacity-60",
                    state === "home" && "text-secondary",
                  )}
                >
                  <FeedAvatar title={feed.title} faviconUrl={resolveFeedIcon(feed.icon, feed.link)} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{feed.title}</span>
                  {feed.last_error && <span role="img" aria-label={`${feed.title} refresh failed`} title="The last refresh failed" className="text-warning-primary">!</span>}
                  <NextIcon aria-hidden className="size-3.5 flex-none text-quaternary opacity-0 group-hover:opacity-100" />
                  <span data-testid="feed-count" className={COUNT_CLASSES}>{feed.unreadCount > 0 ? feed.unreadCount : ''}</span>
                </button>
              </div>
            </GridListItem>
          );
        }}
      </GridList>
    </div>
  );
}
