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
}

// =============== Feed Category ===============

export interface FeedCategoryTable {
  id: Generated<number>;
  name: string;
};

export type FeedCategory = Selectable<FeedCategoryTable>;
export type NewFeedCategory = Insertable<FeedCategoryTable>;
export type UpdateFeedCategory = Updateable<FeedCategoryTable>;

// =============== Feed ===============

export interface FeedMetadataTable {
  id: Generated<number>;
  link: string;
  title: string;
  category_id: number;
}

export type FeedMetadata = Selectable<FeedMetadataTable>;
export type NewFeedMetadata = Insertable<FeedMetadataTable>;
export type UpdateFeedMetadata = Updateable<FeedMetadataTable>;

// =============== Feed Item ===============

export interface FeedItemTable {
  id: Generated<number>;
  feed_id: number;
  title: string;
  link: string | undefined;
  pubDate: string;
};

export type FeedItem = Selectable<FeedItemTable>;
export type NewFeedItem = Insertable<FeedItemTable>;
export type UpdateFeedItem = Updateable<FeedItemTable>;

