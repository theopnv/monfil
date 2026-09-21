import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
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
  setting: SettingTable
  articleContent: ArticleContentTable
}

// =============== Workspace ===============
// A workspace is a tab in the left rail: Home, or an installed pack / OPML import. See doc/feedpacks.md.

export interface WorkspaceTable {
  id: Generated<number>;
  name: string;
  icon: string;
  color: string;
  position: number;
  source_slug: string | undefined;
  source_version: string | undefined;
  installed_at: string | undefined;
}

export type WorkspaceRow = Selectable<WorkspaceTable>;
export type NewWorkspace = Insertable<WorkspaceTable>;
export type UpdateWorkspace = Updateable<WorkspaceTable>;

// =============== Feed Category ===============
// A category is a name (e.g. "Tech", "News"...) scoped to one workspace.

export interface FeedCategoryTable {
  id: Generated<number>;
  name: string;
  workspace_id: number;
};

export type FeedCategoryRow = Selectable<FeedCategoryTable>;
export type NewFeedCategory = Insertable<FeedCategoryTable>;
export type UpdateFeedCategory = Updateable<FeedCategoryTable>;

// =============== Feed ===============
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
  icon: string | undefined;
}

export type FeedMetadataRow = Selectable<FeedMetadataTable>;
export type NewFeedMetadata = Insertable<FeedMetadataTable>;
export type UpdateFeedMetadata = Updateable<FeedMetadataTable>;

// =============== Feed Placement ===============
// Where a feed appears. Separate from feedMetadata so one feed can belong to several workspaces at
// once, sharing one fetch and one read state. At most one placement per (feed_id, workspace_id).

export interface FeedPlacementTable {
  feed_id: number;
  category_id: number;
  workspace_id: number;
  showInWorkspace: Generated<number>;
}

export type FeedPlacement = Selectable<FeedPlacementTable>;
export type NewFeedPlacement = Insertable<FeedPlacementTable>;
export type UpdateFeedPlacement = Updateable<FeedPlacementTable>;

// =============== Feed Item ===============
// A feed item is a single entry in a feed (e.g. a blog post, a podcast episode, etc)

export interface FeedItemTable {
  id: Generated<number>;
  feed_id: number;
  title: string;
  guid: string;
  link: string | undefined;
  pubDate: string;
  description: string;
  // Derived from `pubDate` on insert, since SQLite cannot parse RFC-822 in SQL. Epoch ms, `0` when unparseable.
  // `Generated`, like `showInWorkspace`: the DB default only matters for a row that bypasses `addFeedItemsToDatabase`.
  published_at: Generated<number>;
  // Derived from `description` on insert: plain text, truncated. Powers the river list without shipping the full body.
  excerpt: Generated<string>;
  image: string | undefined;
  author: string | undefined;
  // A JSON blob for the fields only some source types carry. See doc/sources.md.
  extra: string | undefined;
  // Select/insert stay `string | undefined`, per the nullable-column convention (see `link`, `image`).
  // Update additionally allows `null`, the one write path that must be able to clear the column back to unread.
  read_at: ColumnType<string | undefined, string | undefined, string | null>;
};

export type FeedItem = Selectable<FeedItemTable>;
export type NewFeedItem = Insertable<FeedItemTable>;
export type UpdateFeedItem = Updateable<FeedItemTable>;

// =============== Article Content ===============
// Article content is the full text of a feed item, fetched and stored separately from the feed item itself.

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
export type UpdateArticleContent = Updateable<ArticleContentTable>;

// =============== Setting ===============
// Settings are key-value pairs for application configuration.

export interface SettingTable {
  key: string;
  value: string;
};

export type Setting = Selectable<SettingTable>;
export type NewSetting = Insertable<SettingTable>;
export type UpdateSetting = Updateable<SettingTable>;
