import { contextBridge, ipcRenderer } from "electron/renderer";
import type { IpcRendererEvent } from "electron";
import type { ChannelPayloads, Channels, InvokeChannels } from "./channels";

const electronHandler = {
  ipcRenderer: {
    sendMessage<C extends Channels>(channel: C, payload: ChannelPayloads[C]) {
      ipcRenderer.send(channel, payload);
    },
    on<C extends Channels>(channel: C, func: (payload: ChannelPayloads[C]) => void) {
      const subscription = (_event: IpcRendererEvent, payload: ChannelPayloads[C]) =>
        func(payload);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once<C extends Channels>(channel: C, func: (payload: ChannelPayloads[C]) => void) {
      ipcRenderer.once(channel, (_event, payload: ChannelPayloads[C]) => func(payload));
    },
    invoke<C extends InvokeChannels>(channel: C): Promise<ChannelPayloads[C]> {
      return ipcRenderer.invoke(channel);
    }
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
