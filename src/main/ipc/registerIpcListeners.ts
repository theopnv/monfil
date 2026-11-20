// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { ipcMain } from "electron";
import type { IpcMainEvent } from "electron";
import type { OneWayRendererToMainChannelPayloads, OneWayRendererToMainChannels } from "../../shared/channels";
import { listenToInstallUpdate, listenToLinkOpen, listenToRendererLog, listenToReveal, listenToRestart, listenToSetWindowTheme, listenToShowMenu, listenToUsagePreferences, listenToUsageRecord } from "./listeners";

type Listener<C extends OneWayRendererToMainChannels> = (
  event: IpcMainEvent,
  payload: OneWayRendererToMainChannelPayloads[C],
) => void;

const listeners: { [C in OneWayRendererToMainChannels]: Listener<C> } = {
  "link:open": listenToLinkOpen,
  "menu:show": listenToShowMenu,
  "app:reveal": listenToReveal,
  "app:restart": listenToRestart,
  "app:install-update": listenToInstallUpdate,
  "app:set-window-theme": listenToSetWindowTheme,
  "log:write": listenToRendererLog,
  "usage:record": listenToUsageRecord,
  "usage:preferences": listenToUsagePreferences,
};

export function registerIpcListeners() {
  for (const [channel, listener] of Object.entries(listeners) as [OneWayRendererToMainChannels, Listener<OneWayRendererToMainChannels>][]) {
    ipcMain.on(channel, listener);
  }
}
