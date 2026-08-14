import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Feed } from "../../preload/channels";

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

export const FeedsProvider = ({ children }: PropsWithChildren) => {
  const [feeds, setFeeds] = useState<Feed[]>([]);

  const addFeed = useCallback((feed: Feed) => {
    setFeeds((prev) => [...prev.filter((f) => f.link !== feed.link), feed]);
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.invoke('feeds:list', undefined)
      .then(setFeeds)
      .catch((error: unknown) => {
        console.error('Error loading feeds:', error);
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
      <AddFeedContext.Provider value={addFeed}>{children}</AddFeedContext.Provider>
    </FeedsContext.Provider>
  );
};
