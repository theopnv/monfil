import type {
  AddFeedError,
  AppInfo,
  CatalogError,
  CreateCategoryError,
  CreateWorkspaceError,
  DeleteCategoryError,
  DeleteFeedError,
  DeleteWorkspaceError,
  ExportOpmlError,
  FeedCategory,
  FeedFetchError,
  FeedpackCatalog,
  FeedpackError,
  FeedpackInstallTarget,
  FeedpackPreview,
  FeedSummary,
  ImportOpmlError,
  ImportOpmlTarget,
  ImportSummary,
  InstallFeedpackError,
  ItemBody,
  MaxFeedItems,
  MoveFeedError,
  NewFeedInput,
  ParsedSource,
  RefreshInterval,
  RefreshSummary,
  RiverPage,
  RiverQuery,
  SourceType,
  StartupHealth,
  UpdateCategoryError,
  UpdateFeedError,
  UpdateItemError,
  UpdateWorkspaceError,
  Workspace,
  WorkspaceSummary,
} from './contracts';
import type { Result } from './result';
import type { LogEventMap, LogEventName, LogLevel } from './logging';

export type OneWayRendererToMainChannelPayloads = {
  'link:open': string;
  'feeds:show-feed-context-menu': number;
  'feeds:show-category-context-menu': number;
  'workspaces:show-context-menu': number;
  'app:reveal-database-file': undefined;
  'app:reveal-log-file': undefined;
  'app:reveal-database-backup': undefined;
  'app:restart': undefined;
  'log:write': { level: LogLevel; event: LogEventName; data: LogEventMap[LogEventName]; error?: string };
};

export type OneWayRendererToMainChannels = keyof OneWayRendererToMainChannelPayloads;

export type OneWayMainToRendererChannelPayloads = {
  'feeds:item-image-fetched': { feedId: number; itemId: number; image: string };
  'feeds:refreshed': RefreshSummary;
  'feeds:delete-feed-requested': number;
  'feeds:rename-category-requested': number;
  'feeds:delete-category-requested': number;
  'workspaces:edit-requested': number;
  'workspaces:export-requested': number;
  'workspaces:delete-requested': number;
  'feedpacks:install-finished': { workspaceId: number; imported: number; failed: { title: string; message: string }[] };
};

export type OneWayMainToRendererChannels = keyof OneWayMainToRendererChannelPayloads;

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
  'app:get-startup-health': StartupHealth;
  'settings:get-detailed-logging': boolean;
  'settings:set-detailed-logging': boolean;
  'opml:import': Result<ImportSummary, ImportOpmlError>;
  'opml:export': Result<void, ExportOpmlError>;
  'feedpacks:list': Result<FeedpackCatalog, CatalogError>;
  'feedpacks:preview': Result<FeedpackPreview, FeedpackError>;
  'feedpacks:install': Result<ImportSummary, InstallFeedpackError>;
};

export type TwoWayRendererMainChannels = keyof TwoWayRendererMainChannelPayloads;

export type TwoWayRendererMainChannelsInvokeArgs = {
  'feeds:validate-feed-url': { query: string; type?: SourceType };
  'feeds:list-categories': { workspaceId: number };
  'feeds:list': { workspaceId: number };
  'items:query': RiverQuery;
  'feeds:refresh': undefined;
  'feeds:submit-add-feed': NewFeedInput;
  'feeds:delete-feed': { feedId: number; workspaceId: number };
  'feeds:set-show-in-workspace': { feedIds: number[]; showInWorkspace: boolean; workspaceId: number };
  'feeds:create-category': { name: string; workspaceId: number };
  'feeds:rename-category': { categoryId: number; name: string; workspaceId: number };
  'feeds:delete-category': { categoryId: number; reassignTo: number; workspaceId: number };
  'feeds:move-feeds-to-category': { feedIds: number[]; categoryId: number; workspaceId: number };
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
  'app:get-startup-health': undefined;
  'settings:get-detailed-logging': undefined;
  'settings:set-detailed-logging': boolean;
  'opml:import': { target: ImportOpmlTarget };
  'opml:export': { workspaceId: number };
  'feedpacks:list': undefined;
  'feedpacks:preview': { slug: string };
  'feedpacks:install': { slug: string; target: FeedpackInstallTarget };
};

export type ChannelPayloads = OneWayRendererToMainChannelPayloads
  & OneWayMainToRendererChannelPayloads
  & TwoWayRendererMainChannelPayloads;

export type Channels = keyof ChannelPayloads;

export interface ElectronHandler {
  ipcRenderer: {
    sendMessage<C extends OneWayRendererToMainChannels>(channel: C, payload: OneWayRendererToMainChannelPayloads[C]): void;
    on<C extends OneWayMainToRendererChannels>(channel: C, func: (payload: OneWayMainToRendererChannelPayloads[C]) => void): () => void;
    once<C extends OneWayMainToRendererChannels>(channel: C, func: (payload: OneWayMainToRendererChannelPayloads[C]) => void): void;
    invoke<C extends TwoWayRendererMainChannels>(channel: C, arg: TwoWayRendererMainChannelsInvokeArgs[C]): Promise<TwoWayRendererMainChannelPayloads[C]>;
  };
}
