import { BrowserWindow, Menu, shell, type IpcMainEvent } from "electron";
import type { OneWayRendererToMainChannelPayloads } from "../../preload/channels";
import { dbFilePath } from "../database";
import { sendToRenderer } from "./sendToRenderer";

export function listenToLinkOpen(_event: IpcMainEvent, url: OneWayRendererToMainChannelPayloads["link:open"]) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  // Feed item links come from untrusted, third-party RSS content, so only http(s) URLs are handed to the OS.
  // Anything else (file:, javascript:, a custom protocol handler) is dropped.
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    void shell.openExternal(url);
  }
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
