import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { ChannelPayloads, TwoWayRendererMainChannelsInvokeArgs, TwoWayRendererMainChannels } from "../../preload/channels";
import {
  handleAppGetInfo,
  handleFeedsDeleteFeed,
  handleFeedsList,
  handleFeedsListCategories,
  handleFeedsRefresh,
  handleFeedsSetShowInHome,
  handleFeedsSubmitAddFeed,
  handleFeedsValidateFeedUrl,
  handleItemsGetContent,
  handleItemsSetRead,
  handleSettingsGetRefreshInterval,
  handleSettingsGetRefreshOnLaunch,
  handleSettingsSetRefreshInterval,
  handleSettingsSetRefreshOnLaunch,
} from "./handlers";

// IPC Handlers - Main from and to Renderer (two ways)
// On the renderer side (exposed through preload): ipcRenderer.invoke(channel, ...args)
// Handled by the main side: ipcMain.handle(channel, listener)
// https://www.electronjs.org/docs/latest/tutorial/ipc#pattern-2-renderer-to-main-two-way

type Handler<C extends TwoWayRendererMainChannels> = (
  event: IpcMainInvokeEvent,
  arg: TwoWayRendererMainChannelsInvokeArgs[C],
) => ChannelPayloads[C] | Promise<ChannelPayloads[C]>;

const handlers: { [C in TwoWayRendererMainChannels]: Handler<C> } = {
  "feeds:validate-feed-url": handleFeedsValidateFeedUrl,
  "feeds:list-categories": handleFeedsListCategories,
  "feeds:list": handleFeedsList,
  "feeds:refresh": handleFeedsRefresh,
  "feeds:submit-add-feed": handleFeedsSubmitAddFeed,
  "feeds:delete-feed": handleFeedsDeleteFeed,
  "feeds:set-show-in-home": handleFeedsSetShowInHome,
  "settings:get-refresh-interval": handleSettingsGetRefreshInterval,
  "settings:set-refresh-interval": handleSettingsSetRefreshInterval,
  "items:set-read": handleItemsSetRead,
  "items:get-content": handleItemsGetContent,
  "settings:get-refresh-on-launch": handleSettingsGetRefreshOnLaunch,
  "settings:set-refresh-on-launch": handleSettingsSetRefreshOnLaunch,
  "app:get-info": handleAppGetInfo,
};

export function registerIpcHandlers() {
  for (const [channel, handler] of Object.entries(handlers) as [TwoWayRendererMainChannels, Handler<TwoWayRendererMainChannels>][]) {
    ipcMain.handle(channel, handler);
  }
}
