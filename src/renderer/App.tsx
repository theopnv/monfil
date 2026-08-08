import { useCallback, useEffect, useState } from "react";
import type { FeedItem } from "../main/parse";

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
    <div className="App">
      <button onClick={updateNodeVersion}>
        Node version is {nodeVersion}
      </button>

      {Object.entries(feeds).map(([url, result]) => (
        <section key={url}>
          <h2>{url}</h2>
          {result.success ? (
            <ul>
              {result.value.map((item) => (
                <li key={item.link}>
                  <a href={item.link} target="_blank" rel="noreferrer">{item.title}</a> — {item.pubDate}
                </li>
              ))}
            </ul>
          ) : (
            <p>Failed to load: {result.error.message}</p>
          )}
        </section>
      ))}
    </div>
  );
}
