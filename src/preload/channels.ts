import type { FeedMetadata, FeedCategory, SourceType, Workspace } from '../main/db/types';
import type { NewFeedInput, AddFeedError, CreateCategoryError, CreateWorkspaceError } from '../main/db/crud/insert';
import type { DeleteCategoryError, DeleteFeedError, DeleteWorkspaceError } from '../main/db/crud/delete';
import type { MoveFeedError, UpdateCategoryError, UpdateFeedError, UpdateItemError, UpdateWorkspaceError } from '../main/db/crud/update';
import type { ParsedSource, FeedFetchError } from '../main/feed/sources/types';
import type { MaxFeedItems, RefreshInterval } from '../main/settings';
import type { AppInfo } from '../main/app-info';
import type { Result } from '../main/lib/utils';
import type { ImportOpmlError, ImportOpmlTarget, ImportSummary } from '../main/opml/import';
import type { ExportOpmlError } from '../main/opml/export';

// =====================================
// ============== TYPES ================
// =====================================

// Expose types from main process to preload, so that the renderer can use them without importing from main directly.
export type { RefreshInterval, MaxFeedItems } from '../main/settings';
export type { FeedCategory, SourceType, Workspace } from '../main/db/types';
export { HOME_WORKSPACE_ID } from '../main/db/types';
export type { ParsedSource, FeedFetchError } from '../main/feed/sources/types';

// Some types are only used in the preload layer, so we define them here instead of main.
export type FeedSummary = FeedMetadata & {
  showInWorkspace: number;
  workspaceId: number;
  category: FeedCategory;
  itemCount: number;
  unreadCount: number;
};

export type WorkspaceSummary = Workspace & { hasUnread: boolean };

export type RiverRow = {
  id: number;
  title: string;
  link: string | undefined;
  publishedAt: number;
  excerpt: string;
  image: string | undefined;
  readAt: string | undefined;
  feedId: number;
  feedTitle: string;
  feedLink: string;
  feedIcon: string | undefined;
  categoryName: string;
  type: SourceType;
};

export type RiverCursor = { publishedAt: number; id: number };

export type RiverQuery = {
  workspaceId: number;
  feedIds?: number[]; // omitted = every feed with showInWorkspace = 1
  ids?: number[]; // exact rows, for a Reader deep link outside the window
  unreadOnly?: boolean;
  search?: string;
  cursor?: RiverCursor;
  limit: number;
};

export type RiverPage = { rows: RiverRow[]; nextCursor?: RiverCursor };
export type RefreshSummary = { perFeed: { feedId: number; inserted: number }[] };
export type ItemBody = {
  description: string; // raw, unstripped
  article: { html: string; wordCount: number } | undefined;
};

// =====================================
// ============= CHANNELS ==============
// =====================================

// ============= One-way channels (renderer -> main) ==============
export type OneWayRendererToMainChannelPayloads = {
  'link:open': string;
  'feeds:show-feed-context-menu': number;
  'feeds:show-category-context-menu': number;
  'workspaces:show-context-menu': number;
  'app:reveal-database-file': undefined;
}
export type OneWayRendererToMainChannels = keyof OneWayRendererToMainChannelPayloads;

// ============= One-way channels (main -> renderer) ==============

// webContents.send does not buffer, so the renderer's listener must attach before it is sent.
// Make sure this is set up correctly before sending through new channels.
export type OneWayMainToRendererChannelPayloads = {
  'feeds:item-image-fetched': { feedId: number; itemId: number; image: string };
  'feeds:refreshed': RefreshSummary;
  'feeds:delete-feed-requested': number;
  'feeds:rename-category-requested': number;
  'feeds:delete-category-requested': number;
  'workspaces:edit-requested': number;
  'workspaces:export-requested': number;
  'workspaces:delete-requested': number;
};

export type OneWayMainToRendererChannels = keyof OneWayMainToRendererChannelPayloads;

// ============ Two-way channels (renderer <-> main) ==============
export type TwoWayRendererMainChannelPayloads = {
  'feeds:validate-feed-url': Result<ParsedSource, FeedFetchError>;
  'feeds:list-categories': FeedCategory[];
  'feeds:list': FeedSummary[];
  'items:query': RiverPage;
  'feeds:refresh': RefreshSummary;
  'feeds:submit-add-feed': Result<FeedSummary, AddFeedError>;
  'feeds:delete-feed': Result<void, DeleteFeedError>;
  'feeds:set-show-in-workspace': Result<void, UpdateFeedError>;
  'feeds:create-category': Result<FeedCategory, CreateCategoryError>;
  'feeds:rename-category': Result<FeedCategory, UpdateCategoryError>;
  'feeds:delete-category': Result<void, DeleteCategoryError>;
  'feeds:move-feeds-to-category': Result<void, UpdateCategoryError>;
  'feeds:move-to-workspace': Result<void, MoveFeedError>;
  'workspaces:list': WorkspaceSummary[];
  'workspaces:create': Result<Workspace, CreateWorkspaceError>;
  'workspaces:update': Result<Workspace, UpdateWorkspaceError>;
  'workspaces:delete': Result<void, DeleteWorkspaceError>;
  'workspaces:reorder': Result<void, UpdateWorkspaceError>;
  'settings:get-refresh-interval': RefreshInterval;
  'settings:set-refresh-interval': RefreshInterval;
  'items:set-read': Result<void, UpdateItemError>;
  'items:get-content': ItemBody;
  'settings:get-refresh-on-launch': boolean;
  'settings:set-refresh-on-launch': boolean;
  'settings:get-max-feed-items': MaxFeedItems;
  'settings:set-max-feed-items': MaxFeedItems;
  'app:get-info': AppInfo;
  'opml:import': Result<ImportSummary, ImportOpmlError>;
  'opml:export': Result<void, ExportOpmlError>;
}

export type TwoWayRendererMainChannels = keyof TwoWayRendererMainChannelPayloads;

export type TwoWayRendererMainChannelsInvokeArgs = {
  'feeds:validate-feed-url': { query: string; type?: SourceType };
  'feeds:list-categories': { workspaceId: number };
  'feeds:list': { workspaceId: number };
  'items:query': RiverQuery;
  'feeds:refresh': undefined;
  'feeds:submit-add-feed': NewFeedInput;
  'feeds:delete-feed': number;
  'feeds:set-show-in-workspace': { feedIds: number[]; showInWorkspace: boolean };
  'feeds:create-category': { name: string };
  'feeds:rename-category': { categoryId: number; name: string };
  'feeds:delete-category': { categoryId: number; reassignTo: number };
  'feeds:move-feeds-to-category': { feedIds: number[]; categoryId: number };
  'feeds:move-to-workspace': { feedId: number; fromWorkspaceId: number; toWorkspaceId: number; categoryName: string };
  'workspaces:list': undefined;
  'workspaces:create': { name: string; icon: string; color: string };
  'workspaces:update': { workspaceId: number; name?: string; icon?: string; color?: string };
  'workspaces:delete': { workspaceId: number };
  'workspaces:reorder': { orderedIds: number[] };
  'settings:get-refresh-interval': undefined;
  'settings:set-refresh-interval': RefreshInterval;
  'items:set-read': { itemIds: number[]; read: boolean };
  'items:get-content': number;
  'settings:get-refresh-on-launch': undefined;
  'settings:set-refresh-on-launch': boolean;
  'settings:get-max-feed-items': undefined;
  'settings:set-max-feed-items': MaxFeedItems;
  'app:get-info': undefined;
  'opml:import': { target: ImportOpmlTarget };
  'opml:export': { workspaceId: number };
};

// ============= Combined channel types ==============
export type ChannelPayloads = OneWayRendererToMainChannelPayloads
  & OneWayMainToRendererChannelPayloads
  & TwoWayRendererMainChannelPayloads;

export type Channels = keyof ChannelPayloads;
