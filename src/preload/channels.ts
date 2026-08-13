import type { FeedMetadata, FeedItem, FeedCategory } from '../main/types';
import type { FetchUrlError } from '../main/fetch';

export type FeedError = FetchUrlError | { name: 'PARSE_ERROR'; message: string };

export type Feed = FeedMetadata & { items: FeedItem[]; category: FeedCategory };
export type FeedResult =
  | { success: true; value: Feed }
  | { success: false; error: FeedError };

// Single source of truth for every IPC channel's payload, shared by preload
// (renderer side) and main (send/handle call sites) so a mismatch fails to compile.
export type ChannelPayloads = {
  'utils:get-node-version': string;
  'feeds:result': FeedResult;
  'link:open': string;
};

export type Channels = keyof ChannelPayloads;

// Channels invoked by the renderer via ipcRenderer.invoke, requiring an ipcMain.handle.
export type InvokeChannels = Extract<Channels, 'utils:get-node-version'>;

// Channels sent one-way by the renderer via ipcRenderer.send, requiring an ipcMain.on.
export type SendChannels = Extract<Channels, 'link:open'>;
