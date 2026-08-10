import type { FeedMetadata, FeedItem } from '../main/types';
import type { FetchUrlError } from '../main/fetch';

export type FeedError = FetchUrlError | { name: 'PARSE_ERROR'; message: string };

export type Feed = FeedMetadata & { items: FeedItem[] };
export type FeedResult =
  | { success: true; value: Feed }
  | { success: false; error: FeedError };

// Single source of truth for every IPC channel's payload, shared by preload
// (renderer side) and main (send/handle call sites) so a mismatch fails to compile.
export type ChannelPayloads = {
  'utils:get-node-version': string;
  'feeds:result': FeedResult;
};

export type Channels = keyof ChannelPayloads;

// Channels invoked by the renderer via ipcRenderer.invoke, requiring an ipcMain.handle.
export type InvokeChannels = Extract<Channels, 'utils:get-node-version'>;
