import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { ChannelPayloads, InvokeChannels } from "../preload/channels";

type Handler<C extends InvokeChannels> = (
  event: IpcMainInvokeEvent,
) => ChannelPayloads[C] | Promise<ChannelPayloads[C]>;

const handlers: { [C in InvokeChannels]: Handler<C> } = {
  "utils:get-node-version": () => process.versions.node
};

export function registerIpcHandlers() {
  for (const [channel, handler] of Object.entries(handlers) as [InvokeChannels, Handler<InvokeChannels>][]) {
    ipcMain.handle(channel, handler);
  }
}
