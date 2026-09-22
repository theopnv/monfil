// Home is inserted as the first row by the migration that creates this table, and it can never be
// deleted, so its id is permanently 1.
export const HOME_WORKSPACE_ID = 1;

export type SourceType = 'rss' | 'youtube';
export type RefreshInterval = 15 | 30 | 60 | 360 | 'manual';
export type MaxFeedItems = 10 | 30 | 50 | 100;

export type StartupHealth =
  | { name: 'OK' }
  | { name: 'RESET'; incidentId: string }
  | { name: 'FAILED'; incidentId: string };

export interface Workspace {
  id: number;
  name: string;
  icon: string;
  color: string;
  position: number;
  source_slug: string | undefined;
  source_version: string | undefined;
  installed_at: string | undefined;
}

export interface FeedCategory {
  id: number;
  name: string;
  workspace_id: number;
}

export interface FeedMetadata {
  id: number;
  link: string;
  title: string;
  type: SourceType;
  last_fetched_at: string | undefined;
  last_error: string | undefined | null;
  icon: string | undefined;
}

export interface SourceItem {
  title: string;
  guid: string;
  link: string | undefined;
  pubDate: string;
  description: string;
  image: string | undefined;
  author: string | undefined;
  extra: string | undefined;
  read_at: string | undefined;
}

export type ParsedSource = Omit<FeedMetadata, 'id' | 'last_fetched_at' | 'last_error'> & {
  description: string;
  items: SourceItem[];
};

export type FetchUrlError =
  | { name: 'GENERIC_FETCH_ERROR'; message: string }
  | { name: 'NETWORK_ERROR'; message: string }
  | { name: 'NOT_ALLOWED_OR_ABORTED_ERROR'; message: string }
  | { name: 'RESPONSE_TOO_LARGE_ERROR'; message: string }
  | { name: 'BLOCKED_URL_ERROR'; message: string };

export type FeedFetchError =
  | FetchUrlError
  | { name: 'PARSE_ERROR' | 'UNKNOWN_ERROR' | 'UNSUPPORTED_FORMAT'; message: string };

export interface NewFeedInput {
  link: string;
  title: string;
  type: SourceType;
  items: SourceItem[];
  categoryName: string;
  workspaceId: number;
  showInWorkspace: boolean;
  icon?: string;
}

export type AddFeedError = { name: 'DB_ERROR'; message: string };
export type CreateCategoryError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'DUPLICATE_NAME'; message: string };
export type CreateWorkspaceError = { name: 'DB_ERROR'; message: string };
export type DeleteFeedError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'FEED_NOT_FOUND'; message: string };
export type DeleteCategoryError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'CATEGORY_NOT_FOUND'; message: string };
export type DeleteWorkspaceError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string }
  | { name: 'HOME_NOT_DELETABLE'; message: string };
export type UpdateFeedError = DeleteFeedError;
export type MoveFeedError = DeleteFeedError;
export type UpdateWorkspaceError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string };
export type UpdateItemError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'ITEM_NOT_FOUND'; message: string };
export type UpdateCategoryError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'CATEGORY_NOT_FOUND'; message: string }
  | { name: 'DUPLICATE_NAME'; message: string };

export type FeedSummary = FeedMetadata & {
  showInWorkspace: number;
  workspaceId: number;
  category: FeedCategory;
  itemCount: number;
  unreadCount: number;
};

export type WorkspaceSummary = Workspace & { hasUnread: boolean };

export interface RiverRow {
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
}

export interface RiverCursor {
  publishedAt: number;
  id: number;
}

export interface RiverQuery {
  workspaceId: number;
  // Omitted means every feed with showInWorkspace = 1.
  feedIds?: number[];
  // Exact rows let a Reader deep link query outside the current window.
  ids?: number[];
  unreadOnly?: boolean;
  search?: string;
  cursor?: RiverCursor;
  limit: number;
}

export interface RiverPage {
  rows: RiverRow[];
  nextCursor?: RiverCursor;
}

export interface RefreshSummary {
  perFeed: { feedId: number; inserted: number }[];
  failedFeedIds?: number[];
}

export interface ItemBody {
  // This stays raw until the renderer sanitizes it for display.
  description: string;
  article: { html: string; wordCount: number } | undefined;
}

export interface AppInfo {
  version: string;
  feedCount: number;
  itemCount: number;
  databaseSizeBytes: number;
}

export interface ParsedOpmlFeed {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  type: SourceType;
}

export interface ParsedOpmlCategory {
  name: string;
  feeds: ParsedOpmlFeed[];
}

export interface ParsedOpml {
  title: string;
  categories: ParsedOpmlCategory[];
}

export type ParseOpmlError =
  | { name: 'MALFORMED_XML'; message: string }
  | { name: 'NO_FEEDS'; message: string };

export interface ImportSkipped {
  title: string;
  reason: string;
}

export interface ImportFailed {
  title: string;
  message: string;
}

export interface ImportSummary {
  workspaceId: number;
  imported: number;
  skipped: ImportSkipped[];
  failed: ImportFailed[];
}

export type ImportOpmlTarget =
  | { kind: 'new-workspace'; name: string; icon: string; color: string; sourceSlug?: string; sourceVersion?: string }
  | { kind: 'merge-workspace'; workspaceId: number };

export type ImportOpmlError =
  | ParseOpmlError
  | { name: 'DB_ERROR'; message: string }
  | { name: 'FS_ERROR'; message: string }
  | { name: 'CANCELLED'; message: string };

export type ExportOpmlError =
  | { name: 'WORKSPACE_NOT_FOUND'; message: string }
  | { name: 'CANCELLED'; message: string }
  | { name: 'FS_ERROR'; message: string };

export interface Feedpack {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  curator: string;
  sourceCount: number;
  updatedAt: string;
  opml: string;
}

export interface FeedpackCatalog {
  version: 1;
  packs: Feedpack[];
}

export type CatalogError =
  | { name: 'UNSUPPORTED_VERSION'; message: string }
  | { name: 'INVALID_CATALOG'; message: string }
  | { name: 'UNAVAILABLE'; message: string };

export type FeedpackError =
  | CatalogError
  | ParseOpmlError
  | { name: 'PACK_NOT_FOUND'; message: string }
  | { name: 'FETCH_ERROR'; message: string };

export type InstallFeedpackError = FeedpackError | ImportOpmlError;

export interface FeedpackPreview {
  pack: Feedpack;
  sources: ParsedOpml;
}

export type FeedpackInstallTarget =
  | { kind: 'new-workspace'; name: string; icon: string; color: string }
  | { kind: 'merge-workspace'; workspaceId: number };
