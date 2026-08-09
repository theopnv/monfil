import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { InvokeChannels } from "../preload/channels";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const handlers: Record<InvokeChannels, Handler> = {
  "utils:get-node-version": () => process.versions.node
};

export function registerIpcHandlers() {
  for (const [channel, handler] of Object.entries(handlers) as [InvokeChannels, Handler][]) {
    ipcMain.handle(channel, handler);
  }
}
