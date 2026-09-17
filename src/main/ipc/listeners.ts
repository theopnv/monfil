import { BrowserWindow, Menu, shell, type IpcMainEvent } from "electron";
import type { OneWayRendererToMainChannelPayloads } from "../../preload/channels";
import { dbFilePath } from "../db/database";
import { HOME_WORKSPACE_ID } from "../db/types";
import { sendToRenderer } from "./sendToRenderer";
import { openExternalLink } from "../window-security";

export function listenToLinkOpen(_event: IpcMainEvent, url: OneWayRendererToMainChannelPayloads["link:open"]) {
  openExternalLink(url);
}

export function listenToRevealDatabaseFile() {
  shell.showItemInFolder(dbFilePath);
}

export function listenToShowFeedContextMenu(event: IpcMainEvent, feedId: OneWayRendererToMainChannelPayloads["feeds:show-feed-context-menu"]) {
  const menu = Menu.buildFromTemplate([
    {
      label: "Delete feed",
      click: () => sendToRenderer(event.sender, "feeds:delete-feed-requested", feedId),
    },
  ]);
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    menu.popup({ window });
  }
}

export function listenToShowCategoryContextMenu(event: IpcMainEvent, categoryId: OneWayRendererToMainChannelPayloads["feeds:show-category-context-menu"]) {
  const menu = Menu.buildFromTemplate([
    {
      label: "Rename",
      click: () => sendToRenderer(event.sender, "feeds:rename-category-requested", categoryId),
    },
    {
      label: "Delete",
      click: () => sendToRenderer(event.sender, "feeds:delete-category-requested", categoryId),
    },
  ]);
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    menu.popup({ window });
  }
}

export function listenToShowWorkspaceContextMenu(event: IpcMainEvent, workspaceId: OneWayRendererToMainChannelPayloads["workspaces:show-context-menu"]) {
  const menu = Menu.buildFromTemplate([
    {
      label: "Edit workspace",
      click: () => sendToRenderer(event.sender, "workspaces:edit-requested", workspaceId),
    },
    {
      label: "Export as OPML",
      click: () => sendToRenderer(event.sender, "workspaces:export-requested", workspaceId),
    },
    // Home is the one workspace every install always has; it cannot be deleted.
    ...(workspaceId === HOME_WORKSPACE_ID ? [] : [{
      label: "Delete workspace",
      click: () => sendToRenderer(event.sender, "workspaces:delete-requested", workspaceId),
    }]),
  ]);
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    menu.popup({ window });
  }
}
