import { useEffect, useState } from "react";
import { ChevronRight, Plus } from "@untitledui/icons";
import AddFeedModal from "@/components/AddFeed/AddFeedModal";
import DeleteFeedDialog from "@/components/Home/DeleteFeedDialog";
import FeedAvatar from "@/components/Home/FeedAvatar";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { cx } from "@/components/untitled-ui/utils/cx";
import { getFaviconUrl } from "@/lib/favicon";
import type { Feed } from "../../../preload/channels";

export interface RiverSidebarProps {
  feeds: Feed[];
  selectedFeedLink: string | null;
  onSelectFeed: (link: string | null) => void;
}

interface Folder {
  name: string;
  feeds: Feed[];
  count: number;
}

function groupByCategory(feeds: Feed[]): Folder[] {
  const folders = new Map<string, Folder>();
  for (const feed of feeds) {
    const name = feed.category.name;
    const folder = folders.get(name) ?? { name, feeds: [], count: 0 };
    folder.feeds.push(feed);
    folder.count += feed.items.length;
    folders.set(name, folder);
  }
  return [...folders.values()];
}

export default function RiverSidebar({ feeds, selectedFeedLink, onSelectFeed }: RiverSidebarProps) {
  const folders = groupByCategory(feeds);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [feedPendingDelete, setFeedPendingDelete] = useState<Feed | null>(null);

  useEffect(() => {
    return window.electron.ipcRenderer.on('feeds:delete-feed-requested', (feedId) => {
      setFeedPendingDelete((prev) => feeds.find((feed) => feed.id === feedId) ?? prev);
    });
  }, [feeds]);

  function handleFeedDeleted(deleted: Feed) {
    if (deleted.link === selectedFeedLink) {
      onSelectFeed(null);
    }
  }

  return (
    <div className="flex h-full w-64 flex-none flex-col gap-1.5 overflow-y-auto border-r border-secondary bg-[color-mix(in_srgb,var(--color-bg-secondary)_45%,var(--color-bg-primary))] py-3">
      <div className="flex items-center justify-between px-4.5 pb-2">
        <span className="text-xs font-bold tracking-wide text-quaternary uppercase">Feeds</span>
        <Button aria-label="Add feed" size="xs" color="tertiary" iconLeading={Plus} onPress={() => setIsAddFeedOpen(true)} />
      </div>
      <AddFeedModal isOpen={isAddFeedOpen} onOpenChange={setIsAddFeedOpen} />
      <DeleteFeedDialog
        feed={feedPendingDelete}
        onOpenChange={(isOpen) => { if (!isOpen) setFeedPendingDelete(null); }}
        onDeleted={handleFeedDeleted}
      />
      <div className="flex flex-col gap-px px-2.5">
        {folders.map((folder) => {
          const isOpen = open[folder.name] ?? false;

          return (
            <div key={folder.name} className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [folder.name]: !isOpen }))}
                className="flex w-full items-center gap-1.5 rounded-xl px-2.25 py-1.75 text-left text-sm font-semibold text-primary hover:bg-primary_hover"
              >
                <ChevronRight className={cx("size-3.25 flex-none text-quaternary transition-transform", isOpen && "rotate-90")} />
                <span className="flex-1">{folder.name}</span>
                <span className="text-xs font-bold text-quaternary tabular-nums">{folder.count}</span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-px pl-2">
                  {folder.feeds.map((feed) => {
                    const isSelected = feed.link === selectedFeedLink;

                    return (
                      <button
                        key={feed.link}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onSelectFeed(isSelected ? null : feed.link)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          window.electron.ipcRenderer.sendMessage('feeds:show-feed-context-menu', feed.id);
                        }}
                        className={cx(
                          "flex w-full items-center gap-2.25 rounded-xl px-2.25 py-1.5 text-left text-sm hover:bg-primary_hover",
                          isSelected ? "bg-primary_hover font-semibold text-primary" : "text-secondary",
                        )}
                      >
                        <FeedAvatar title={feed.title} faviconUrl={getFaviconUrl(feed.link)} size="sm" />
                        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{feed.title}</span>
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
