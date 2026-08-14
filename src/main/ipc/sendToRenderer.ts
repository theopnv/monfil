import type { WebContents } from 'electron';
import type { OneWayMainToRendererChannelPayloads, OneWayMainToRendererChannels } from '../../preload/channels';

export function sendToRenderer<C extends OneWayMainToRendererChannels>(
  sender: WebContents,
  channel: C,
  payload: OneWayMainToRendererChannelPayloads[C],
): void {
  if (sender.isDestroyed()) return;
  sender.send(channel, payload);
}
