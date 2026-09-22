import { contextBridge, ipcRenderer } from "electron/renderer";
import type { IpcRendererEvent } from "electron";
import type {
  ElectronHandler,
  OneWayMainToRendererChannelPayloads,
  OneWayMainToRendererChannels,
  OneWayRendererToMainChannelPayloads,
  OneWayRendererToMainChannels,
  TwoWayRendererMainChannelPayloads,
  TwoWayRendererMainChannels,
  TwoWayRendererMainChannelsInvokeArgs,
} from "../shared/channels";

const electronHandler: ElectronHandler = {
  ipcRenderer: {
    sendMessage<C extends OneWayRendererToMainChannels>(channel: C, payload: OneWayRendererToMainChannelPayloads[C]) {
      ipcRenderer.send(channel, payload);
    },
    on<C extends OneWayMainToRendererChannels>(channel: C, func: (payload: OneWayMainToRendererChannelPayloads[C]) => void) {
      const subscription = (_event: IpcRendererEvent, payload: OneWayMainToRendererChannelPayloads[C]) =>
        func(payload);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once<C extends OneWayMainToRendererChannels>(channel: C, func: (payload: OneWayMainToRendererChannelPayloads[C]) => void) {
      ipcRenderer.once(channel, (_event, payload: OneWayMainToRendererChannelPayloads[C]) => func(payload));
    },
    invoke<C extends TwoWayRendererMainChannels>(channel: C, arg: TwoWayRendererMainChannelsInvokeArgs[C]): Promise<TwoWayRendererMainChannelPayloads[C]> {
      return ipcRenderer.invoke(channel, arg);
    }
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);
