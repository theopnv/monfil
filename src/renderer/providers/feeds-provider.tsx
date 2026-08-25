import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { Feed } from "../../preload/channels";
import type { DeleteFeedError } from "../../main/db/delete";
import type { UpdateFeedError } from "../../main/db/update";
import type { Result } from "../../utils";

const FeedsContext = createContext<Feed[] | undefined>(undefined);

export const useFeeds = (): Feed[] => {
  const context = useContext(FeedsContext);

  if (context === undefined) {
    throw new Error("useFeeds must be used within a FeedsProvider");
  }

  return context;
};

const AddFeedContext = createContext<((feed: Feed) => void) | undefined>(undefined);

export const useAddFeed = (): ((feed: Feed) => void) => {
  const context = useContext(AddFeedContext);

  if (context === undefined) {
    throw new Error("useAddFeed must be used within a FeedsProvider");
  }

  return context;
};

const DeleteFeedContext = createContext<((feedId: number) => Promise<Result<Feed[], DeleteFeedError>>) | undefined>(undefined);

export const useDeleteFeed = (): ((feedId: number) => Promise<Result<Feed[], DeleteFeedError>>) => {
  const context = useContext(DeleteFeedContext);

  if (context === undefined) {
    throw new Error("useDeleteFeed must be used within a FeedsProvider");
  }

  return context;
};

const SetShowInHomeContext = createContext<((feedIds: number[], showInHome: boolean) => Promise<Result<Feed[], UpdateFeedError>>) | undefined>(undefined);

export const useSetShowInHome = (): ((feedIds: number[], showInHome: boolean) => Promise<Result<Feed[], UpdateFeedError>>) => {
  const context = useContext(SetShowInHomeContext);

  if (context === undefined) {
    throw new Error("useSetShowInHome must be used within a FeedsProvider");
  }

  return context;
};

interface FeedsRefresh {
  refreshNow: () => void;
  isRefreshing: boolean;
}

const FeedsRefreshContext = createContext<FeedsRefresh | undefined>(undefined);

export const useFeedsRefresh = (): FeedsRefresh => {
  const context = useContext(FeedsRefreshContext);

  if (context === undefined) {
    throw new Error("useFeedsRefresh must be used within a FeedsProvider");
  }

  return context;
};

interface ReadState {
  isRead: (id: number) => boolean;
  markRead: (id: number) => void;
  toggleRead: (id: number) => void;
  markAllRead: (ids: number[]) => void;
}

const ReadStateContext = createContext<ReadState | undefined>(undefined);

export const useReadState = (): ReadState => {
  const context = useContext(ReadStateContext);

  if (context === undefined) {
    throw new Error("useReadState must be used within a FeedsProvider");
  }

  return context;
};

export const FeedsProvider = ({ children }: PropsWithChildren) => {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // The mount-time invoke and a launch-refresh push resolve in either order. Once a refreshed list
  // has arrived, an older snapshot must not land on top of it.
  const hasFreshList = useRef(false);

  const addFeed = useCallback((feed: Feed) => {
    setFeeds((prev) => [...prev.filter((f) => f.link !== feed.link), feed]);
  }, []);

  const deleteFeed = useCallback(async (feedId: number) => {
    const response = await window.electron.ipcRenderer.invoke('feeds:delete-feed', feedId);
    if (response.success) {
      hasFreshList.current = true;
      setFeeds(response.data);
    }
    return response;
  }, []);

  const setShowInHome = useCallback(async (feedIds: number[], showInHome: boolean) => {
    const response = await window.electron.ipcRenderer.invoke('feeds:set-show-in-home', { feedIds, showInHome });
    if (response.success) {
      hasFreshList.current = true;
      setFeeds(response.data);
    }
    return response;
  }, []);

  // `feedItem.read_at` is the one source of truth for read state, so it survives a restart.
  const readIds = useMemo(() => {
    const ids = new Set<number>();
    for (const feed of feeds) {
      for (const item of feed.items) {
        if (item.read_at) {
          ids.add(item.id);
        }
      }
    }
    return ids;
  }, [feeds]);

  const isRead = useCallback((id: number) => readIds.has(id), [readIds]);

  const setRead = useCallback((itemIds: number[], read: boolean) => {
    if (itemIds.length === 0) {
      return;
    }
    const targetIds = new Set(itemIds);
    const readAt = read ? new Date().toISOString() : undefined;
    setFeeds((prev) => prev.map((feed) => (
      feed.items.some((item) => targetIds.has(item.id))
        ? { ...feed, items: feed.items.map((item) => (targetIds.has(item.id) ? { ...item, read_at: readAt } : item)) }
        : feed
    )));
    window.electron.ipcRenderer.invoke('items:set-read', { itemIds, read }).catch((error: unknown) => {
      console.error('Error persisting read state:', error);
    });
  }, []);

  const markRead = useCallback((id: number) => setRead([id], true), [setRead]);
  const toggleRead = useCallback((id: number) => setRead([id], !isRead(id)), [setRead, isRead]);
  const markAllRead = useCallback((ids: number[]) => setRead(ids, true), [setRead]);

  const readState = useMemo<ReadState>(() => ({ isRead, markRead, toggleRead, markAllRead }), [isRead, markRead, toggleRead, markAllRead]);

  const refreshNow = useCallback(() => {
    setIsRefreshing(true);
    window.electron.ipcRenderer.invoke('feeds:refresh', undefined)
      .then((refreshed) => {
        hasFreshList.current = true;
        setFeeds(refreshed);
      })
      .catch((error: unknown) => {
        console.error('Error refreshing feeds:', error);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, []);

  const refresh = useMemo<FeedsRefresh>(() => ({ refreshNow, isRefreshing }), [refreshNow, isRefreshing]);

  useEffect(() => {
    window.electron.ipcRenderer.invoke('feeds:list', undefined)
      .then((listed) => {
        if (hasFreshList.current) {
          return;
        }
        setFeeds(listed);
      })
      .catch((error: unknown) => {
        console.error('Error loading feeds:', error);
      });
  }, []);

  useEffect(() => {
    return window.electron.ipcRenderer.on('feeds:list', (pushed) => {
      hasFreshList.current = true;
      setFeeds(pushed);
    });
  }, []);

  useEffect(() => {
    return window.electron.ipcRenderer.on('feeds:item-image-fetched', ({ feedId, itemId, image }) => {
      setFeeds((prev) => prev.map((feed) =>
        feed.id !== feedId
          ? feed
          : { ...feed, items: feed.items.map((item) => (item.id === itemId ? { ...item, image } : item)) }
      ));
    });
  }, []);

  return (
    <FeedsContext.Provider value={feeds}>
      <AddFeedContext.Provider value={addFeed}>
        <DeleteFeedContext.Provider value={deleteFeed}>
          <SetShowInHomeContext.Provider value={setShowInHome}>
            <FeedsRefreshContext.Provider value={refresh}>
              <ReadStateContext.Provider value={readState}>{children}</ReadStateContext.Provider>
            </FeedsRefreshContext.Provider>
          </SetShowInHomeContext.Provider>
        </DeleteFeedContext.Provider>
      </AddFeedContext.Provider>
    </FeedsContext.Provider>
  );
};
