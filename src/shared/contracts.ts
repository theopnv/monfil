// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ErrorParams } from './errors';
import type { LanguageCode, LanguageSetting } from './i18n/languages';

// Home is inserted as the first row by the migration that creates this table, and it can never be
// deleted, so its id is permanently 1.
/** The command-line argument that tells the preload script whether the first-run hints may show. */
export const HINTS_ARGUMENT = '--hints-enabled=';

export const HOME_WORKSPACE_ID = 1;

export const SOURCE_TYPES = ['rss', 'youtube', 'github', 'gitlab', 'hackernews', 'arxiv', 'bluesky', 'mastodon', 'conference', 'ats'] as const;
export type SourceType = typeof SOURCE_TYPES[number];
export const REFRESH_INTERVALS = [15, 30, 60, 360, 'manual'] as const;
export type RefreshInterval = typeof REFRESH_INTERVALS[number];
export const RETENTION_OPTIONS = [15, 30, 60, 90, 180] as const;
export type RetentionDays = typeof RETENTION_OPTIONS[number];

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
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string; params?: ErrorParams }
  | { name: 'SEARCH_NOT_FOUND'; message: string; params?: ErrorParams }
  | { name: 'DUPLICATE_NAME'; message: string; params?: ErrorParams }
  | { name: 'INVALID_INPUT'; message: string; params?: ErrorParams };

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
  last_error_code?: string | undefined | null;
  last_error_params?: ErrorParams | undefined | null;
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

export type ParsedSource = Omit<FeedMetadata, 'id' | 'last_fetched_at' | 'last_error' | 'last_error_code' | 'last_error_params'> & {
  description: string;
  items: SourceItem[];
  /** Names this feed among the candidates one link offers, e.g. "Releases" or "100+ points". */
  label?: string;
  /** The website the feed belongs to, where a missing icon is looked up. */
  siteLink?: string | undefined;
};

export type FetchUrlError =
  | { name: 'GENERIC_FETCH_ERROR'; message: string; params?: ErrorParams }
  | { name: 'NETWORK_ERROR'; message: string; params?: ErrorParams }
  | { name: 'NOT_ALLOWED_OR_ABORTED_ERROR'; message: string; params?: ErrorParams }
  | { name: 'RESPONSE_TOO_LARGE_ERROR'; message: string; params?: ErrorParams }
  | { name: 'BLOCKED_URL_ERROR'; message: string; params?: ErrorParams };

export type FeedFetchError =
  | FetchUrlError
  | { name: 'PARSE_ERROR' | 'UNKNOWN_ERROR' | 'UNSUPPORTED_FORMAT'; message: string; params?: ErrorParams };

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

export type AddFeedError = { name: 'DB_ERROR'; message: string; params?: ErrorParams };
export type CreateCategoryError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'DUPLICATE_NAME'; message: string; params?: ErrorParams };
export type CreateWorkspaceError = { name: 'DB_ERROR'; message: string; params?: ErrorParams };
export type DeleteFeedError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'FEED_NOT_FOUND'; message: string; params?: ErrorParams };
export type DeleteCategoryError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'CATEGORY_NOT_FOUND'; message: string; params?: ErrorParams };
export type DeleteWorkspaceError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string; params?: ErrorParams }
  | { name: 'LAST_WORKSPACE_NOT_DELETABLE'; message: string; params?: ErrorParams };
export type UpdateFeedError = DeleteFeedError;
export type MoveFeedError = DeleteFeedError;
export type UpdateWorkspaceError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string; params?: ErrorParams };
export type DismissSearchHintError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string; params?: ErrorParams };
export type BackupError = { name: 'CANCELLED' | 'BACKUP_FAILED'; message: string; params?: ErrorParams };
export type UpdateItemError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'ITEM_NOT_FOUND'; message: string; params?: ErrorParams };

export type UpdateSavedItemError = UpdateItemError | { name: 'WORKSPACE_NOT_FOUND'; message: string; params?: ErrorParams };

export interface SetSavedItemInput {
  workspaceId: number;
  itemId: number;
  saved: boolean;
}
export type UpdateCategoryError =
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'CATEGORY_NOT_FOUND'; message: string; params?: ErrorParams }
  | { name: 'DUPLICATE_NAME'; message: string; params?: ErrorParams };

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
  failedFeeds?: { feedId: number; title: string; message: string; code: string; params?: ErrorParams }[];
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
  | { name: 'MALFORMED_XML'; message: string; params?: ErrorParams }
  | { name: 'NO_FEEDS'; message: string; params?: ErrorParams };

export interface ImportSkipped {
  title: string;
  reason: 'ALREADY_IN_WORKSPACE';
}

export interface ImportFailed {
  title: string;
  message: string;
  code: string | undefined;
  params?: ErrorParams | undefined;
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
  | { name: 'DB_ERROR'; message: string; params?: ErrorParams }
  | { name: 'FS_ERROR'; message: string; params?: ErrorParams }
  | { name: 'CANCELLED'; message: string; params?: ErrorParams };

export type ExportOpmlError =
  | { name: 'WORKSPACE_NOT_FOUND'; message: string; params?: ErrorParams }
  | { name: 'NO_FEEDS'; message: string; params?: ErrorParams }
  | { name: 'CANCELLED'; message: string; params?: ErrorParams }
  | { name: 'FS_ERROR'; message: string; params?: ErrorParams };

export interface FeedpackText {
  title: string;
  description: string;
}

export interface Feedpack {
  slug: string;
  title: string;
  description: string;
  /** The title and description in other interface languages. English is the `title` and `description` above. */
  i18n?: Partial<Record<LanguageCode, FeedpackText>> | undefined;
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
  | { name: 'UNSUPPORTED_VERSION'; message: string; params?: ErrorParams }
  | { name: 'INVALID_CATALOG'; message: string; params?: ErrorParams }
  | { name: 'UNAVAILABLE'; message: string; params?: ErrorParams };

export type FeedpackError =
  | CatalogError
  | ParseOpmlError
  | { name: 'PACK_NOT_FOUND'; message: string; params?: ErrorParams }
  | { name: 'FETCH_ERROR'; message: string; params?: ErrorParams };

export type InstallFeedpackError = FeedpackError | ImportOpmlError;

export interface FeedpackPreview {
  pack: Feedpack;
  sources: ParsedOpml;
}

export type FeedpackInstallTarget =
  | { kind: 'new-workspace'; name: string; icon: string; color: string }
  | { kind: 'merge-workspace'; workspaceId: number };

/** Matches the "Last updated" date of the privacy notice in `doc/src/content/docs/user-guide/privacy.md`. */
export const USAGE_ANALYTICS_NOTICE_VERSION = '2026-11-23';

export const USAGE_ANALYTICS_NOTICE_URL = 'https://monfil.app/docs/user-guide/privacy/';

export type UsageAnalyticsConsent = 'unset' | 'granted' | 'denied';

export const RENDERER_USAGE_COUNTERS = ['searches', 'embeds_loaded', 'workspaces_switched'] as const;
export type RendererUsageCounter = typeof RENDERER_USAGE_COUNTERS[number];

const MAIN_USAGE_COUNTERS = [
  'articles_opened', 'fulltext_extracted', 'feeds_added', 'feeds_removed', 'manual_refreshes', 'items_saved',
  'feedpacks_installed', 'opml_imported', 'opml_exported', 'backups_made', 'workspaces_created',
  'refresh_failures', 'extraction_failures', 'ipc_failures', 'renderer_failures',
  'refresh_error_timeout', 'refresh_error_http_4xx', 'refresh_error_http_5xx', 'refresh_error_tls',
  'refresh_error_dns', 'refresh_error_parse', 'refresh_error_too_large',
  'startup_ok', 'startup_failed', 'startup_time_lt_1s', 'startup_time_1_3s', 'startup_time_3_10s', 'startup_time_gt_10s',
  'feed_add_attempted', 'feed_add_succeeded',
  'feed_add_failed_discovery_none', 'feed_add_failed_network', 'feed_add_failed_parse', 'feed_add_failed_unsupported',
] as const;

export const USAGE_COUNTERS = [...MAIN_USAGE_COUNTERS, ...RENDERER_USAGE_COUNTERS] as const;
export type UsageCounter = typeof USAGE_COUNTERS[number];

export interface UsageAnalyticsState {
  consent: UsageAnalyticsConsent;
  shouldPrompt: boolean;
  /** False in a build that has no usage stats endpoint and no error report endpoint, where the choice would change nothing. */
  available: boolean;
}

/** What the renderer needs to offer an error report. `enabled` is true only while error reports are on. */
export interface ErrorReportState {
  enabled: boolean;
}

export interface ErrorReportLogPreview {
  text: string;
  /** True when the log is longer than the part that is attached. */
  truncated: boolean;
}

/** An example of the error report that Monfil sends. It is built on this device from a made-up failure. */
export type ErrorReportSample = Record<string, unknown>;

export interface ErrorReportInput {
  /** The short incident ID that the error screen shows. Without it the report links to the latest event. */
  incidentId?: string | undefined;
  comment: string;
  attachLog: boolean;
}

export type ErrorReportError =
  | { name: 'REPORTS_OFF'; message: string; params?: ErrorParams }
  | { name: 'NO_EVENT'; message: string; params?: ErrorParams };

export const ERROR_REPORT_COMMENT_MAX_LENGTH = 1000;
/** The part of the log that is attached to a report, counted from the end. */
export const ERROR_REPORT_LOG_MAX_BYTES = 1024 * 1024;

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

export interface LanguageState {
  setting: LanguageSetting;
  language: LanguageCode;
  systemLanguage: LanguageCode;
}
