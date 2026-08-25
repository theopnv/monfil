import type {
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely'

export interface Database {
  feedCategory: FeedCategoryTable
  feedMetadata: FeedMetadataTable
  feedItem: FeedItemTable
  setting: SettingTable
  articleContent: ArticleContentTable
}

// =============== Feed Category ===============
// Simple lookup: a category is a name (e.g. "Tech", "News"...)

export interface FeedCategoryTable {
  id: Generated<number>;
  name: string;
};

export type FeedCategory = Selectable<FeedCategoryTable>;
export type NewFeedCategory = Insertable<FeedCategoryTable>;
export type UpdateFeedCategory = Updateable<FeedCategoryTable>;

// =============== Feed ===============
// A feed is anything the user wants to subscribe to (e.g. RSS, podcasts, bluesky feed, etc)

export interface FeedMetadataTable {
  id: Generated<number>;
  link: string;
  title: string;
  category_id: number;
  showInHome: Generated<number>;
}

export type FeedMetadata = Selectable<FeedMetadataTable>;
export type NewFeedMetadata = Insertable<FeedMetadataTable>;
export type UpdateFeedMetadata = Updateable<FeedMetadataTable>;

// =============== Feed Item ===============
// A feed item is a single entry in a feed (e.g. a blog post, a podcast episode, etc)

export interface FeedItemTable {
  id: Generated<number>;
  feed_id: number;
  title: string;
  link: string | undefined;
  pubDate: string;
  description: string;
  image: string | undefined;
  // Select/insert stay `string | undefined`, per the nullable-column convention (see `link`, `image`).
  // Update additionally allows `null`, the one write path that must be able to clear the column back to unread.
  read_at: string | undefined | null;
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
