import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import type { FeedItem } from "../main/parse";
import { ThemeToggle } from "./components/ThemeToggle";

type FeedError = { name: string; message: string };
type FeedResult =
  | { success: true; value: FeedItem[] }
  | { success: false; error: FeedError };

export default function App() {
  const [nodeVersion, setNodeVersion] = useState<string | undefined>(undefined);
  const [feeds, setFeeds] = useState<Record<string, FeedResult>>({});

  const updateNodeVersion = useCallback(
    async () => {
      const nodeVersion = await window.electron.ipcRenderer.invoke('utils:get-node-version');
      setNodeVersion(nodeVersion) },
    []
  );

  useEffect(() => {
    return window.electron.ipcRenderer.on('feeds:result', (payload) => {
      const { url, result } = payload as { url: string; result: FeedResult };
      setFeeds((prev) => ({ ...prev, [url]: result }));
    });
  }, []);

  return (
    <div className="App min-h-screen bg-primary text-primary">
      <div className="container mx-auto p-4">
        <ThemeToggle />
        <Button onClick={updateNodeVersion} className="mt-2">
          Node version is {nodeVersion}
        </Button>

        {Object.entries(feeds).map(([url, result]) => (
          <section key={url} className="mt-6 border-b border-secondary pb-6">
            <h1 className="text-2xl font-bold text-brand-secondary">{url}</h1>
            {result.success ? (
              <ul className="mt-2 space-y-1">
                {result.value.map((item) => (
                  <li key={item.link} className="text-secondary">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-secondary hover:text-brand-secondary_hover"
                    >
                      {item.title}
                    </a>{' '}
                    — {item.pubDate}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-error-primary">Failed to load: {result.error.message}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
