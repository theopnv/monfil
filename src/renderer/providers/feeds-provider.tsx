import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { FeedItem } from "../../main/parse";

type FeedError = { name: string; message: string };
export type FeedResult =
  | { success: true; value: FeedItem[] }
  | { success: false; error: FeedError };

const FeedsContext = createContext<Record<string, FeedResult> | undefined>(undefined);

export const useFeeds = (): Record<string, FeedResult> => {
  const context = useContext(FeedsContext);

  if (context === undefined) {
    throw new Error("useFeeds must be used within a FeedsProvider");
  }

  return context;
};

export const FeedsProvider = ({ children }: PropsWithChildren) => {
  const [feeds, setFeeds] = useState<Record<string, FeedResult>>({});

  useEffect(() => {
    return window.electron.ipcRenderer.on('feeds:result', (payload) => {
      const { url, result } = payload as { url: string; result: FeedResult };
      setFeeds((prev) => ({ ...prev, [url]: result }));
    });
  }, []);

  return <FeedsContext.Provider value={feeds}>{children}</FeedsContext.Provider>;
};
