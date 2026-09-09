import { useEffect, useState } from "react";
import { ChevronRight, Plus } from "@untitledui/icons";
import AddFeedModal from "@/components/AddFeed/AddFeedModal";
import DeleteFeedDialog from "@/components/Home/DeleteFeedDialog";
import FeedAvatar from "@/components/Home/FeedAvatar";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { cx } from "@/components/untitled-ui/utils/cx";
import { feedVisibility, folderVisibility, nextVisibility, VISIBILITY_ICON, VISIBILITY_LABEL, type FeedVisibility } from "@/lib/river/feed-visibility";
import { getFaviconUrl } from "@/lib/favicon";
import { readLocalStorageJSON, writeLocalStorageJSON } from "@/lib/local-storage";
import type { Feed } from "../../../preload/channels";

export interface RiverSidebarProps {
  feeds: Feed[];
  showOnlyLinks: ReadonlySet<string>;
  onSetVisibility: (feeds: Feed[], target: FeedVisibility) => void;
  onFeedDeleted: (feed: Feed) => void;
}

interface Folder {
  name: string;
  feeds: Feed[];
  count: number;
  open: boolean;
}

const OPEN_FOLDERS_STORAGE_KEY = 'sidebar-open-folders';

function loadOpenFolderNames(): Set<string> {
  const parsed = readLocalStorageJSON(OPEN_FOLDERS_STORAGE_KEY);
  return new Set(Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : []);
}

function saveOpenFolderNames(names: Iterable<string>): void {
  writeLocalStorageJSON(OPEN_FOLDERS_STORAGE_KEY, [...names]);
}

function groupByCategory(feeds: Feed[]): Folder[] {
  const openFolderNames = loadOpenFolderNames();
  const folders = new Map<string, Folder>();
  for (const feed of feeds) {
    const name = feed.category.name;
    const folder = folders.get(name) ?? { name, feeds: [], count: 0, open: openFolderNames.has(name) };
    folder.feeds.push(feed);
    folder.count += feed.items.length;
    folders.set(name, folder);
  }
  return [...folders.values()];
}

export default function RiverSidebar({ feeds, showOnlyLinks, onSetVisibility, onFeedDeleted }: RiverSidebarProps) {
  const [folders, setFolders] = useState(() => groupByCategory(feeds));
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [feedPendingDelete, setFeedPendingDelete] = useState<Feed | null>(null);

  useEffect(() => {
    setFolders((prev) => {
      const openByName = new Map(prev.map((folder) => [folder.name, folder.open]));
      return groupByCategory(feeds).map((folder) => ({ ...folder, open: openByName.get(folder.name) ?? folder.open }));
    });
  }, [feeds]);

  useEffect(() => {
    return window.electron.ipcRenderer.on('feeds:delete-feed-requested', (feedId) => {
      setFeedPendingDelete((prev) => feeds.find((feed) => feed.id === feedId) ?? prev);
    });
  }, [feeds]);

  return (
    <div className="flex h-full w-64 flex-none flex-col gap-1.5 overflow-y-auto border-r border-secondary bg-[color-mix(in_srgb,var(--color-bg-secondary)_45%,var(--color-bg-primary))] py-3">
      <div className="flex items-center justify-between px-4.5 pb-2">
        <span className="text-xs font-bold tracking-wide text-quaternary uppercase">Feeds</span>
        <Button aria-label="Add feed" size="xs" color="tertiary" iconLeading={Plus} onPress={() => setIsAddFeedOpen(true)} />
      </div>
      <AddFeedModal isOpen={isAddFeedOpen} onOpenChange={setIsAddFeedOpen} />
      <DeleteFeedDialog
        feed={feedPendingDelete}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setFeedPendingDelete(null);
          }
        }}
        onDeleted={onFeedDeleted}
      />
      <div className="flex flex-col gap-px px-2.5">
        {folders.map((folder) => {
          const folderState = folderVisibility(folder.feeds, showOnlyLinks);
          const folderNext = nextVisibility(folderState);
          const FolderNextIcon = VISIBILITY_ICON[folderNext];

          return (
            <div key={folder.name} className="flex flex-col">
              <div
                className={cx(
                  "group flex w-full items-center gap-1.5 rounded-xl px-2.25 py-1.75 text-sm font-semibold hover:bg-primary_hover",
                  folderState === "hidden" ? "text-quaternary opacity-60" : "text-primary",
                )}
              >
                <button
                  type="button"
                  onClick={() => setFolders((prev) => {
                    const next = prev.map((f) => (f.name === folder.name ? { ...f, open: !f.open } : f));
                    saveOpenFolderNames(next.filter((f) => f.open).map((f) => f.name));
                    return next;
                  })}
                  className="flex flex-1 items-center gap-1.5 text-left"
                >
                  <ChevronRight className={cx("size-3.25 flex-none text-quaternary transition-transform", folder.open && "rotate-90")} />
                  <span className="flex-1">{folder.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${VISIBILITY_LABEL[folderNext]}: ${folder.name}`}
                  onClick={() => onSetVisibility(folder.feeds, folderNext)}
                  className="flex-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <FolderNextIcon aria-hidden className="size-3.5 text-quaternary" />
                </button>
                <span className="text-xs font-bold text-quaternary tabular-nums">{folder.count}</span>
              </div>

              {folder.open && (
                <div className="flex flex-col gap-px pl-2">
                  {folder.feeds.map((feed) => {
                    const state = feedVisibility(feed, showOnlyLinks);
                    const next = nextVisibility(state);
                    const NextIcon = VISIBILITY_ICON[next];

                    return (
                      <button
                        key={feed.link}
                        type="button"
                        title={`${feed.title} — ${VISIBILITY_LABEL[next]}`}
                        data-visibility={state}
                        onClick={() => onSetVisibility([feed], next)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          window.electron.ipcRenderer.sendMessage('feeds:show-feed-context-menu', feed.id);
                        }}
                        className={cx(
                          "group flex w-full items-center gap-2.25 rounded-xl px-2.25 py-1.5 text-left text-sm hover:bg-primary_hover",
                          state === "only" && "bg-primary_hover font-semibold text-primary",
                          state === "hidden" && "text-quaternary opacity-60",
                          state === "home" && "text-secondary",
                        )}
                      >
                        <FeedAvatar title={feed.title} faviconUrl={getFaviconUrl(feed.link)} size="sm" />
                        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{feed.title}</span>
                        <NextIcon aria-hidden className="size-3.5 flex-none text-quaternary opacity-0 group-hover:opacity-100" />
                        <span className="text-xs text-quaternary tabular-nums">{feed.items.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
