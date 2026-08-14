import type { BrowserWindow } from "electron";
import type { Channels, ChannelPayloads } from "../../preload/channels";

export function sendToRenderer<C extends Channels>(
  window: BrowserWindow,
  channel: C,
  payload: ChannelPayloads[C],
) {
  window.webContents.send(channel, payload);
}
