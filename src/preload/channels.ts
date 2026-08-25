import type { FeedMetadata, FeedItem, FeedCategory } from '../main/db/types';
import type { NewFeedInput, AddFeedError } from '../main/db/crud/insert';
import type { DeleteFeedError } from '../main/db/crud/delete';
import type { UpdateFeedError, UpdateItemError } from '../main/db/crud/update';
import type { ParsedFeed, FeedFetchError } from '../main/feed/parse';
import type { RefreshInterval } from '../main/settings';
import type { AppInfo } from '../main/app-info';
import type { Result } from '../utils';

// =====================================
// ============== TYPES ================
// =====================================

// Expose types from main process to preload, so that the renderer can use them without importing from main directly.
export type { RefreshInterval } from '../main/settings';
export type { FeedCategory } from '../main/db/types';

// Some types are only used in the preload layer, so we define them here instead of main.
export type Feed = FeedMetadata & { items: FeedItem[]; category: FeedCategory };
export type ArticleContentResult =
  | { status: 'ok'; html: string; wordCount: number }
  | { status: 'unavailable' };

// =====================================
// ============= CHANNELS ==============
// =====================================

// ============= One-way channels (renderer -> main) ==============
export type OneWayRendererToMainChannelPayloads = {
  'link:open': string;
  'feeds:show-feed-context-menu': number;
  'app:reveal-database-file': undefined;
}
export type OneWayRendererToMainChannels = keyof OneWayRendererToMainChannelPayloads;

// ============= One-way channels (main -> renderer) ==============

// webContents.send does not buffer, so the renderer's listener must attach before it is sent.
// Make sure this is set up correctly before sending through new channels.
export type OneWayMainToRendererChannelPayloads = {
  'feeds:item-image-fetched': { feedId: number; itemId: number; image: string };
  'feeds:list': Feed[];
  'feeds:delete-feed-requested': number;
};

export type OneWayMainToRendererChannels = keyof OneWayMainToRendererChannelPayloads;

// ============ Two-way channels (renderer <-> main) ==============
export type TwoWayRendererMainChannelPayloads = {
  'feeds:validate-feed-url': Result<ParsedFeed, FeedFetchError>;
  'feeds:list-categories': FeedCategory[];
  'feeds:list': Feed[];
  'feeds:refresh': Feed[];
  'feeds:submit-add-feed': Result<Feed, AddFeedError>;
  'feeds:delete-feed': Result<Feed[], DeleteFeedError>;
  'feeds:set-show-in-home': Result<Feed[], UpdateFeedError>;
  'settings:get-refresh-interval': RefreshInterval;
  'settings:set-refresh-interval': RefreshInterval;
  'items:set-read': Result<void, UpdateItemError>;
  'items:get-content': ArticleContentResult;
  'settings:get-refresh-on-launch': boolean;
  'settings:set-refresh-on-launch': boolean;
  'app:get-info': AppInfo;
}

export type TwoWayRendererMainChannels = keyof TwoWayRendererMainChannelPayloads;

export type TwoWayRendererMainChannelsInvokeArgs = {
  'feeds:validate-feed-url': string;
  'feeds:list-categories': undefined;
  'feeds:list': undefined;
  'feeds:refresh': undefined;
  'feeds:submit-add-feed': NewFeedInput;
  'feeds:delete-feed': number;
  'feeds:set-show-in-home': { feedIds: number[]; showInHome: boolean };
  'settings:get-refresh-interval': undefined;
  'settings:set-refresh-interval': RefreshInterval;
  'items:set-read': { itemIds: number[]; read: boolean };
  'items:get-content': number;
  'settings:get-refresh-on-launch': undefined;
  'settings:set-refresh-on-launch': boolean;
  'app:get-info': undefined;
};

// ============= Combined channel types ==============
export type ChannelPayloads = OneWayRendererToMainChannelPayloads
  & OneWayMainToRendererChannelPayloads
  & TwoWayRendererMainChannelPayloads;

export type Channels = keyof ChannelPayloads;
