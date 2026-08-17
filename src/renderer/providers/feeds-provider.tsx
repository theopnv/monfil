import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { Feed } from "../../preload/channels";
import type { DeleteFeedError } from "../../main/db/delete";
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
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
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

  const isRead = useCallback((id: number) => readIds.has(id), [readIds]);

  const markRead = useCallback((id: number) => {
    setReadIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const toggleRead = useCallback((id: number) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const readState = useMemo<ReadState>(() => ({ isRead, markRead, toggleRead }), [isRead, markRead, toggleRead]);

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
        if (hasFreshList.current) return;
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
          <FeedsRefreshContext.Provider value={refresh}>
            <ReadStateContext.Provider value={readState}>{children}</ReadStateContext.Provider>
          </FeedsRefreshContext.Provider>
        </DeleteFeedContext.Provider>
      </AddFeedContext.Provider>
    </FeedsContext.Provider>
  );
};
