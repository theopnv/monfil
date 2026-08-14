import type { FeedMetadata, FeedItem, FeedCategory } from '../main/db/types';
import type { NewFeedInput, AddFeedError } from '../main/db/insert';
import type { ParsedFeed, FeedFetchError } from '../main/feed/parse';
import type { Result } from '../utils';

export type { FeedCategory } from '../main/db/types';

export type Feed = FeedMetadata & { items: FeedItem[]; category: FeedCategory };

// ============= One-way channels (renderer -> main) ==============
export type OneWayRendererToMainChannelPayloads = {
  'link:open': string;
}
export type OneWayRendererToMainChannels = keyof OneWayRendererToMainChannelPayloads;

// ============= One-way channels (main -> renderer) ==============

// See doc/backend.md's "Talking to the renderer" section before adding another one:
// webContents.send does not buffer, so the renderer's listener must attach before it is sent.
export type OneWayMainToRendererChannelPayloads = {
  'feeds:item-image-fetched': { feedId: number; itemId: number; image: string };
};

export type OneWayMainToRendererChannels = keyof OneWayMainToRendererChannelPayloads;

// ============ Two-way channels (renderer <-> main) ==============
export type TwoWayRendererMainChannelPayloads = {
  'feeds:validate-feed-url': Result<ParsedFeed, FeedFetchError>;
  'feeds:list-categories': FeedCategory[];
  'feeds:list': Feed[];
  'feeds:submit-add-feed': Result<Feed, AddFeedError>;
}

export type TwoWayRendererMainChannels = keyof TwoWayRendererMainChannelPayloads;

export type TwoWayRendererMainChannelsInvokeArgs = {
  'feeds:validate-feed-url': string;
  'feeds:list-categories': undefined;
  'feeds:list': undefined;
  'feeds:submit-add-feed': NewFeedInput;
};

// ============= Combined channel types ==============
export type ChannelPayloads = OneWayRendererToMainChannelPayloads
  & OneWayMainToRendererChannelPayloads
  & TwoWayRendererMainChannelPayloads;

export type Channels = keyof ChannelPayloads;
