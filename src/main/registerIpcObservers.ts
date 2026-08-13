import { ipcMain, shell } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import type { ChannelPayloads, InvokeArgs, InvokeChannels, SendChannels } from "../preload/channels";
import { fetchFeed } from "./feed/parse";
import { queryFeedCategory } from "./db/query";
import { addFeedToDatabase } from "./db/insert";
import { dbReady } from "./database";

type Handler<C extends InvokeChannels> = (
  event: IpcMainInvokeEvent,
  arg: InvokeArgs[C],
) => ChannelPayloads[C] | Promise<ChannelPayloads[C]>;

const handlers: { [C in InvokeChannels]: Handler<C> } = {
  "feeds:validate-feed-url": (_event, query) => fetchFeed(query),
  "feeds:list-categories": async () => { await dbReady; return queryFeedCategory({}); },
  "feeds:submit-add-feed": (_event, payload) => addFeedToDatabase(payload),
};

type Listener<C extends SendChannels> = (
  event: IpcMainEvent,
  payload: ChannelPayloads[C],
) => void;

// Feed item links come from untrusted, third-party RSS content, so only http(s) URLs are handed to the OS.
// Anything else (file:, javascript:, a custom protocol handler) is dropped.
const listeners: { [C in SendChannels]: Listener<C> } = {
  "link:open": (_event, url) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      void shell.openExternal(url);
    }
  },
};

export function registerIpcObservers() {
  for (const [channel, handler] of Object.entries(handlers) as [InvokeChannels, Handler<InvokeChannels>][]) {
    ipcMain.handle(channel, handler);
  }
  for (const [channel, listener] of Object.entries(listeners) as [SendChannels, Listener<SendChannels>][]) {
    ipcMain.on(channel, listener);
  }
}
