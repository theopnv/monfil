// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { ipcMain } from "electron";
import type { IpcMainEvent } from "electron";
import type { OneWayRendererToMainChannelPayloads, OneWayRendererToMainChannels } from "../../shared/channels";
import { listenToLinkOpen, listenToRendererLog, listenToRestart, listenToRevealDatabaseBackup, listenToRevealDatabaseFile, listenToRevealLogFile, listenToSetWindowTheme, listenToShowCategoryContextMenu, listenToShowFeedContextMenu, listenToShowWorkspaceContextMenu } from "./listeners";

// IPC Listeners - Renderer to main
// Triggered from the renderer side (exposed through preload): ipcRenderer.send(channel, payload)
// Handled by the main side: ipcMain.on(channel, listener)
// https://www.electronjs.org/docs/latest/tutorial/ipc#pattern-1-renderer-to-main-one-way

type Listener<C extends OneWayRendererToMainChannels> = (
  event: IpcMainEvent,
  payload: OneWayRendererToMainChannelPayloads[C],
) => void;

const listeners: { [C in OneWayRendererToMainChannels]: Listener<C> } = {
  "link:open": listenToLinkOpen,
  "feeds:show-feed-context-menu": listenToShowFeedContextMenu,
  "feeds:show-category-context-menu": listenToShowCategoryContextMenu,
  "workspaces:show-context-menu": listenToShowWorkspaceContextMenu,
  "app:reveal-database-file": listenToRevealDatabaseFile,
  "app:reveal-log-file": listenToRevealLogFile,
  "app:reveal-database-backup": listenToRevealDatabaseBackup,
  "app:restart": listenToRestart,
  "app:set-window-theme": listenToSetWindowTheme,
  "log:write": listenToRendererLog,
};

export function registerIpcListeners() {
  for (const [channel, listener] of Object.entries(listeners) as [OneWayRendererToMainChannels, Listener<OneWayRendererToMainChannels>][]) {
    ipcMain.on(channel, listener);
  }
}
