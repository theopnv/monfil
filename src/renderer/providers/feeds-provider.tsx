import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Feed } from "../../preload/channels";

const FeedsContext = createContext<Feed[] | undefined>(undefined);

export const useFeeds = (): Feed[] => {
  const context = useContext(FeedsContext);

  if (context === undefined) {
    throw new Error("useFeeds must be used within a FeedsProvider");
  }

  return context;
};

export const FeedsProvider = ({ children }: PropsWithChildren) => {
  const [feeds, setFeeds] = useState<Feed[]>([]);

  useEffect(() => {
    return window.electron.ipcRenderer.on('feeds:result', (result) => {
      if (result.success) {
        setFeeds((prev) => [...prev.filter((feed) => feed.link !== result.value.link), result.value]);
      } else {
        console.error(`Error fetching feed: ${result.error.name} - ${result.error.message}`);
      }
    });
  }, []);

  return <FeedsContext.Provider value={feeds}>{children}</FeedsContext.Provider>;
};
