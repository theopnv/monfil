import type { FeedMetadata, FeedItem, FeedCategory } from '../main/types';
import type { FetchUrlError } from '../main/fetch';
import type { NewFeedInput, AddFeedError } from '../main/db/insert';
import type { ParsedFeed, FeedFetchError } from '../main/feed/parse';
import type { Result } from '../utils';

export type { FeedCategory } from '../main/types';

export type FeedError = FetchUrlError | { name: 'PARSE_ERROR'; message: string };

export type Feed = FeedMetadata & { items: FeedItem[]; category: FeedCategory };
export type FeedResult =
  | { success: true; value: Feed }
  | { success: false; error: FeedError };

// Single source of truth for every IPC channel's payload, shared by preload
// (renderer side) and main (send/handle call sites) so a mismatch fails to compile.
export type ChannelPayloads = {
  'feeds:result': FeedResult;
  'link:open': string;
  'feeds:validate-feed-url': Result<ParsedFeed, FeedFetchError>;
  'feeds:list-categories': FeedCategory[];
  'feeds:submit-add-feed': Result<Feed, AddFeedError>;
};

export type Channels = keyof ChannelPayloads;

// Channels invoked by the renderer via ipcRenderer.invoke, requiring an ipcMain.handle.
export type InvokeChannels = Extract<Channels, 'feeds:validate-feed-url' | 'feeds:list-categories' | 'feeds:submit-add-feed'>;

// Argument passed to ipcRenderer.invoke for each invoke channel.
export type InvokeArgs = {
  'feeds:validate-feed-url': string;
  'feeds:list-categories': undefined;
  'feeds:submit-add-feed': NewFeedInput;
};

// Channels sent one-way by the renderer via ipcRenderer.send, requiring an ipcMain.on.
export type SendChannels = Extract<Channels, 'link:open'>;
