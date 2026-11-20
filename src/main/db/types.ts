// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
} from 'kysely'
import type {
  SourceType,
} from '../../shared/contracts';

export interface Database {
  workspace: WorkspaceTable
  feedCategory: FeedCategoryTable
  feedMetadata: FeedMetadataTable
  feedPlacement: FeedPlacementTable
  feedItem: FeedItemTable
  undatedItem: UndatedItemTable
  setting: SettingTable
  articleContent: ArticleContentTable
  savedItem: SavedItemTable
  usage_counter: UsageCounterTable
  savedSearch: SavedSearchTable
}

// Per-day tallies for opt-in usage analytics. See doc/src/content/docs/contributor-guide/usage-analytics.md.
export interface UsageCounterTable {
  day: string;
  name: string;
  value: number;
}

export interface SavedSearchTable {
  id: Generated<number>;
  workspace_id: number;
  name: string;
  query: string;
  position: number;
  created_at: number;
}


export interface SavedItemTable {
  workspace_id: number;
  item_id: number;
  saved_at: number;
}


// A workspace is a tab in the left rail: Home, or an installed pack / OPML import. See doc/src/content/docs/contributor-guide/feedpacks-and-opml.md.

export interface WorkspaceTable {
  id: Generated<number>;
  name: string;
  icon: string;
  color: string;
  position: number;
  source_slug: string | undefined;
  source_version: string | undefined;
  installed_at: string | undefined;
  // Set once the user dismisses the saved-search hint; it lives here so it goes away with the workspace.
  search_hint_dismissed_at: string | undefined | null;
}



export interface FeedCategoryTable {
  id: Generated<number>;
  name: string;
  workspace_id: number;
};


// A feed is anything the user wants to subscribe to (e.g. RSS, podcasts, bluesky feed, etc). Identity
// only: where it appears (category, workspace, visibility) is feedPlacement, below.

export interface FeedMetadataTable {
  id: Generated<number>;
  link: string;
  title: string;
  type: Generated<SourceType>;
  last_fetched_at: string | undefined;
  // Update additionally allows `null`, so a successful fetch can clear the last failure.
  last_error: string | undefined | null;
  // The stable error name the renderer translates. A row stored before this column has none.
  last_error_code: string | undefined | null;
  last_error_params: string | undefined | null;
  icon: string | undefined;
  // Validators for conditional GET on refresh. The fetch layer may return either or both; each
  // gets sent back as its own header. `null` clears a stale validator after a full re-download.
  etag: string | undefined | null;
  last_modified: string | undefined | null;
}

export type FeedMetadataRow = Selectable<FeedMetadataTable>;

// Where a feed appears. Separate from feedMetadata so one feed can belong to several workspaces at
// once, sharing one fetch and one read state. At most one placement per (feed_id, workspace_id).

export interface FeedPlacementTable {
  feed_id: number;
  category_id: number;
  workspace_id: number;
  showInWorkspace: Generated<number>;
}



export interface FeedItemTable {
  id: Generated<number>;
  feed_id: number;
  title: string;
  guid: string;
  link: string | undefined;
  pubDate: string;
  description: string;
  // Derived from `pubDate` on insert, since SQLite cannot parse RFC-822 in SQL. Missing dates use the first fetch time.
  // `Generated`, like `showInWorkspace`: the DB default only matters for a row that bypasses `addFeedItemsToDatabase`.
  published_at: Generated<number>;
  // Derived from `description` on insert: plain text, truncated. Powers the river list without shipping the full body.
  excerpt: Generated<string>;
  image: string | undefined;
  author: string | undefined;
  // A JSON blob for the fields only some source types carry. See doc/src/content/docs/contributor-guide/feed-sources.md.
  extra: string | undefined;
  // Select/insert stay `string | undefined`, per the nullable-column convention (see `link`, `image`).
  // Update additionally allows `null`, the one write path that must be able to clear the column back to unread.
  read_at: ColumnType<string | undefined, string | undefined, string | null>;
};

export type FeedItem = Selectable<FeedItemTable>;

export interface UndatedItemTable {
  feed_id: number;
  guid: string;
  first_fetched_at: number;
}


// It is interesting to store 'too_short' articles, because they are often paywalls or cookie walls, and the feed item description will then provide more value.
export type ArticleContentStatus = 'ok' | 'failed' | 'too_short';

export interface ArticleContentTable {
  item_id: number;
  html: string | undefined;
  text: string | undefined;
  word_count: number | undefined;
  status: ArticleContentStatus;
}

export type ArticleContent = Selectable<ArticleContentTable>;
export type NewArticleContent = Insertable<ArticleContentTable>;

export interface SettingTable {
  key: string;
  value: string;
};

export type Setting = Selectable<SettingTable>;
