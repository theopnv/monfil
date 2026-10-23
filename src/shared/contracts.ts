// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

// Home is inserted as the first row by the migration that creates this table, and it can never be
// deleted, so its id is permanently 1.
export const HOME_WORKSPACE_ID = 1;

export const SOURCE_TYPES = ['rss', 'youtube', 'github', 'gitlab', 'hackernews', 'arxiv', 'bluesky', 'mastodon', 'conference', 'ats'] as const;
export type SourceType = typeof SOURCE_TYPES[number];
export type RefreshInterval = 15 | 30 | 60 | 360 | 'manual';
export type RetentionDays = 15 | 30 | 60 | 90 | 180;

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

export interface SavedSearch {
  id: number;
  workspace_id: number;
  name: string;
  query: string;
  position: number;
  created_at: number;
}

export type SavedSearchSummary = SavedSearch & { unreadCount: number };

export interface SavedSearchList {
  searches: SavedSearchSummary[];
  // Set only when the workspace has an ats feed, no saved search and no dismissed hint.
  hintExample: string | undefined;
}

export type SavedSearchError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string }
  | { name: 'SEARCH_NOT_FOUND'; message: string }
  | { name: 'DUPLICATE_NAME'; message: string }
  | { name: 'INVALID_INPUT'; message: string };

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
  /** Names this feed among the candidates one link offers, e.g. "Releases" or "100+ points". */
  label?: string;
  /** The website the feed belongs to, where a missing icon is looked up. */
  siteLink?: string | undefined;
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

export type UpdateSavedItemError = UpdateItemError | { name: 'WORKSPACE_NOT_FOUND'; message: string };

export interface SetSavedItemInput {
  workspaceId: number;
  itemId: number;
  saved: boolean;
}
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
  /** How many other workspaces also hold this feed. Above zero, deleting it here keeps its items. */
  otherWorkspaceCount: number;
};

export type WorkspaceSummary = Workspace & { hasUnread: boolean };

/** What a job card shows beyond the title, read from an `ats` item's `extra` JSON. */
export interface JobDetails {
  company: string | undefined;
  location: string | undefined;
  workMode: string | undefined;
  salaryLabel: string | undefined;
}

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
  savedAt?: number | undefined;
  job?: JobDetails;
}

export interface RiverCursor {
  publishedAt: number;
  id: number;
  savedAt?: number | undefined;
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

export interface SavedCursor extends RiverCursor {
  savedAt: number;
}

export type SavedQuery = Omit<RiverQuery, 'feedIds' | 'cursor'> & { cursor?: SavedCursor };

export interface RefreshSummary {
  perFeed: { feedId: number; inserted: number; updated?: number }[];
  removed?: number;
  applyImmediately?: boolean;
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

/** `READY_TO_INSTALL`: an update finished downloading and applies when the app restarts. */
export type AppUpdateState =
  | { name: 'NONE' }
  | { name: 'READY_TO_INSTALL' };

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

/** Matches the "Last updated" date of the privacy notice in `doc/src/content/docs/user-guide/privacy.md`. */
export const USAGE_ANALYTICS_NOTICE_VERSION = '2026-10-23';

export const USAGE_ANALYTICS_NOTICE_URL = 'https://theopnv.github.io/monfil/user-guide/privacy/';

export type UsageAnalyticsConsent = 'unset' | 'granted' | 'denied';

export const RENDERER_USAGE_COUNTERS = ['searches', 'embeds_loaded', 'workspaces_switched'] as const;
export type RendererUsageCounter = typeof RENDERER_USAGE_COUNTERS[number];

export const MAIN_USAGE_COUNTERS = [
  'articles_opened', 'fulltext_extracted', 'feeds_added', 'feeds_removed', 'manual_refreshes', 'items_saved',
  'feedpacks_installed', 'opml_imported', 'opml_exported', 'backups_made', 'workspaces_created',
  'refresh_failures', 'extraction_failures', 'ipc_failures', 'renderer_failures',
] as const;

export const USAGE_COUNTERS = [...MAIN_USAGE_COUNTERS, ...RENDERER_USAGE_COUNTERS] as const;
export type UsageCounter = typeof USAGE_COUNTERS[number];

export interface UsageAnalyticsState {
  consent: UsageAnalyticsConsent;
  shouldPrompt: boolean;
  /** False in a build that has no analytics endpoint, where the choice would change nothing. */
  available: boolean;
}

/** The display settings the renderer keeps in `localStorage`, reported so the daily summary can include them. */
export interface UsagePreferences {
  density: 'Cards' | 'Magazine' | 'Compact';
  theme: 'light' | 'dark' | 'system';
  hideReadItems: boolean;
  markReadOnScroll: boolean;
  openLinksExternally: boolean;
  keyboardNavigation: boolean;
}

export type DailySummaryProps = Record<string, string | number>;
