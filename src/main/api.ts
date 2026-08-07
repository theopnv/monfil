import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { Channels } from "../preload/channels";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const handlers: Record<Channels, Handler> = {
  "utils:get-node-version": () => process.versions.node,
};

export function registerIpcHandlers() {
  for (const [channel, handler] of Object.entries(handlers) as [Channels, Handler][]) {
    ipcMain.handle(channel, handler);
  }
}
