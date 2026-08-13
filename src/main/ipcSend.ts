import type { BrowserWindow } from "electron";
import type { ChannelPayloads, Channels } from "../preload/channels";

export function sendToRenderer<C extends Channels>(
  window: BrowserWindow,
  channel: C,
  payload: ChannelPayloads[C],
) {
  window.webContents.send(channel, payload);
}
