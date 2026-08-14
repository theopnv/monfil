import { ipcMain } from "electron";
import type { IpcMainEvent } from "electron";
import type { OneWayRendererToMainChannelPayloads, OneWayRendererToMainChannels } from "../../preload/channels";
import { listenToLinkOpen } from "./listeners";

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
};

export function registerIpcListeners() {
  for (const [channel, listener] of Object.entries(listeners) as [OneWayRendererToMainChannels, Listener<OneWayRendererToMainChannels>][]) {
    ipcMain.on(channel, listener);
  }
}
