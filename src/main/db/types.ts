import type {
  ColumnType,
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
  showInHome: Generated<number>;
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
  description: string;
  image: string | undefined;
  // Select/insert stay `string | undefined`, per the nullable-column convention (see `link`, `image`).
  // Update additionally allows `null`, the one write path that must be able to clear the column back to unread.
  read_at: ColumnType<string | undefined, string | undefined, string | null>;
};

export type FeedItem = Selectable<FeedItemTable>;
export type NewFeedItem = Insertable<FeedItemTable>;
export type UpdateFeedItem = Updateable<FeedItemTable>;

// =============== Setting ===============

export interface SettingTable {
  key: string;
  value: string;
};

export type Setting = Selectable<SettingTable>;
export type NewSetting = Insertable<SettingTable>;
export type UpdateSetting = Updateable<SettingTable>;
