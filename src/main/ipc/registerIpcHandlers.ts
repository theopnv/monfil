import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { ChannelPayloads, TwoWayRendererMainChannelsInvokeArgs, TwoWayRendererMainChannels } from "../../preload/channels";
import { fetchFeed } from "../feed/parse";
import { queryFeedCategory, queryFeeds } from "../db/query";
import { dbReady } from "../database";
import { handleFeedsSubmitAddFeed } from "./handlers";

// IPC Handlers - Main from and to Renderer (two ways)
// On the renderer side (exposed through preload): ipcRenderer.invoke(channel, ...args)
// Handled by the main side: ipcMain.handle(channel, listener)
// https://www.electronjs.org/docs/latest/tutorial/ipc#pattern-2-renderer-to-main-two-way

type Handler<C extends TwoWayRendererMainChannels> = (
  event: IpcMainInvokeEvent,
  arg: TwoWayRendererMainChannelsInvokeArgs[C],
) => ChannelPayloads[C] | Promise<ChannelPayloads[C]>;

const handlers: { [C in TwoWayRendererMainChannels]: Handler<C> } = {
  // handler functions could be moved to a separate handlers.ts file if they grow too large.
  "feeds:validate-feed-url": (_event, query) => fetchFeed(query),
  "feeds:list-categories": async () => { await dbReady; return queryFeedCategory({}); },
  "feeds:list": async () => { await dbReady; return queryFeeds(); },
  "feeds:submit-add-feed": handleFeedsSubmitAddFeed,
};

export function registerIpcHandlers() {
  for (const [channel, handler] of Object.entries(handlers) as [TwoWayRendererMainChannels, Handler<TwoWayRendererMainChannels>][]) {
    ipcMain.handle(channel, handler);
  }
}
