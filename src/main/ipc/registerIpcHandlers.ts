import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { ChannelPayloads, TwoWayRendererMainChannelsInvokeArgs, TwoWayRendererMainChannels } from "../../preload/channels";
import {
  handleAppGetInfo,
  handleFeedsCreateCategory,
  handleFeedsDeleteCategory,
  handleFeedsDeleteFeed,
  handleFeedsList,
  handleFeedsListCategories,
  handleFeedsMoveFeedsToCategory,
  handleFeedsMoveToWorkspace,
  handleFeedsRefresh,
  handleFeedsRenameCategory,
  handleFeedsSetShowInWorkspace,
  handleFeedsSubmitAddFeed,
  handleFeedsValidateFeedUrl,
  handleItemsGetContent,
  handleItemsQuery,
  handleItemsSetRead,
  handleSettingsGetMaxFeedItems,
  handleSettingsGetRefreshInterval,
  handleSettingsGetRefreshOnLaunch,
  handleSettingsSetMaxFeedItems,
  handleSettingsSetRefreshInterval,
  handleSettingsSetRefreshOnLaunch,
  handleWorkspacesCreate,
  handleWorkspacesDelete,
  handleWorkspacesList,
  handleWorkspacesReorder,
  handleWorkspacesUpdate,
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
  "feeds:set-show-in-workspace": handleFeedsSetShowInWorkspace,
  "feeds:create-category": handleFeedsCreateCategory,
  "feeds:rename-category": handleFeedsRenameCategory,
  "feeds:delete-category": handleFeedsDeleteCategory,
  "feeds:move-feeds-to-category": handleFeedsMoveFeedsToCategory,
  "feeds:move-to-workspace": handleFeedsMoveToWorkspace,
  "workspaces:list": handleWorkspacesList,
  "workspaces:create": handleWorkspacesCreate,
  "workspaces:update": handleWorkspacesUpdate,
  "workspaces:delete": handleWorkspacesDelete,
  "workspaces:reorder": handleWorkspacesReorder,
  "settings:get-refresh-interval": handleSettingsGetRefreshInterval,
  "settings:set-refresh-interval": handleSettingsSetRefreshInterval,
  "items:set-read": handleItemsSetRead,
  "items:get-content": handleItemsGetContent,
  "items:query": handleItemsQuery,
  "settings:get-refresh-on-launch": handleSettingsGetRefreshOnLaunch,
  "settings:set-refresh-on-launch": handleSettingsSetRefreshOnLaunch,
  "settings:get-max-feed-items": handleSettingsGetMaxFeedItems,
  "settings:set-max-feed-items": handleSettingsSetMaxFeedItems,
  "app:get-info": handleAppGetInfo,
};

export function registerIpcHandlers() {
  for (const [channel, handler] of Object.entries(handlers) as [TwoWayRendererMainChannels, Handler<TwoWayRendererMainChannels>][]) {
    ipcMain.handle(channel, handler);
  }
}
