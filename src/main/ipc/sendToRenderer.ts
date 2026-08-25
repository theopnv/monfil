import { BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import type { OneWayMainToRendererChannelPayloads, OneWayMainToRendererChannels } from '../../preload/channels';

export function sendToRenderer<C extends OneWayMainToRendererChannels>(
  sender: WebContents,
  channel: C,
  payload: OneWayMainToRendererChannelPayloads[C],
): void {
  if (sender.isDestroyed()) {
    return;
  }
  sender.send(channel, payload);
}

/**
 * Sends to every open window. For senders that have no originating event.
 * Make sure the renderer is listening before sending, as webContents.send does not buffer.
 * @param channel the channel to send on
 * @param payload the payload to send
 */
export function broadcastToRenderers<C extends OneWayMainToRendererChannels>(
  channel: C,
  payload: OneWayMainToRendererChannelPayloads[C],
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    sendToRenderer(window.webContents, channel, payload);
  }
}
