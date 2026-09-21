import { sql, type SelectQueryBuilder } from 'kysely';
import { type ArticleContent, type Database, type FeedItem, type Setting } from '../types';
import { db, dbReady } from '../database';
import type { FeedCategory, FeedMetadata, FeedSummary, RiverPage, RiverQuery, RiverRow, Workspace, WorkspaceSummary } from '../../../shared/contracts';

// Criteria handlers force us to explicitly add any new field of a table to the query layer.
// Adding a new field to a table object and forgetting to add it here will result in a compilation error.
type CriteriaHandlers<TB extends keyof Database, T> = {
  [K in keyof T]: (
    query: SelectQueryBuilder<Database, TB, T>,
    value: NonNullable<T[K]>
  ) => SelectQueryBuilder<Database, TB, T>;
};

function applyCriteria<TB extends keyof Database, T>(
  query: SelectQueryBuilder<Database, TB, T>,
  criteria: Partial<T>,
  handlers: CriteriaHandlers<TB, T>
): SelectQueryBuilder<Database, TB, T> {
  let result = query;
  for (const key of Object.keys(criteria) as (keyof T)[]) {
    const value = criteria[key];
    if (value !== undefined) {
      result = handlers[key](result, value as NonNullable<T[typeof key]>);
    }
  }
  return result;
}

const feedItemHandlers = {
  id: (q, v) => q.where('id', '=', v),
  feed_id: (q, v) => q.where('feed_id', '=', v),
  title: (q, v) => q.where('title', '=', v),
  guid: (q, v) => q.where('guid', '=', v),
  link: (q, v) => q.where('link', '=', v),
  pubDate: (q, v) => q.where('pubDate', '=', v),
  description: (q, v) => q.where('description', '=', v),
  image: (q, v) => q.where('image', '=', v),
  author: (q, v) => q.where('author', '=', v),
  extra: (q, v) => q.where('extra', '=', v),
  read_at: (q, v) => q.where('read_at', '=', v),
  published_at: (q, v) => q.where('published_at', '=', v),
  excerpt: (q, v) => q.where('excerpt', '=', v),
} satisfies CriteriaHandlers<'feedItem', FeedItem>;

// Ordered explicitly: without it SQLite returns rows in whatever order the chosen index gives,
// which the UNIQUE(feed_id, guid) index made "by guid" rather than the insertion order callers expect.
export async function queryFeedItems(criteria: Partial<FeedItem>): Promise<FeedItem[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('feedItem').selectAll(), criteria, feedItemHandlers).orderBy('id').execute();
}

const feedMetadataHandlers = {
  id: (q, v) => q.where('id', '=', v),
  link: (q, v) => q.where('link', '=', v),
  title: (q, v) => q.where('title', '=', v),
  type: (q, v) => q.where('type', '=', v),
  last_fetched_at: (q, v) => q.where('last_fetched_at', '=', v),
  last_error: (q, v) => q.where('last_error', '=', v),
  icon: (q, v) => q.where('icon', '=', v),
} satisfies CriteriaHandlers<'feedMetadata', FeedMetadata>;

export async function queryFeedMetadata(criteria: Partial<FeedMetadata>): Promise<FeedMetadata[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('feedMetadata').selectAll(), criteria, feedMetadataHandlers).execute();
}

/** Every stored feed whose id is in `ids`, in no particular order. Used to refresh a specific batch (e.g. a freshly imported OPML) rather than every feed. */
export async function queryFeedMetadataByIds(ids: number[]): Promise<FeedMetadata[]> {
  await dbReady;
  if (ids.length === 0) {
    return [];
  }
  return db.selectFrom('feedMetadata').selectAll().where('id', 'in', ids).execute();
}

const feedCategoryHandlers = {
  id: (q, v) => q.where('id', '=', v),
  name: (q, v) => q.where('name', '=', v),
  workspace_id: (q, v) => q.where('workspace_id', '=', v),
} satisfies CriteriaHandlers<'feedCategory', FeedCategory>;

// Ordered explicitly, same reasoning as queryFeedItems: filtering by workspace_id lets SQLite
// satisfy the query from the (workspace_id, name) unique index, which returns rows alphabetically
// by name rather than in creation order once that index is used instead of a full table scan.
export async function queryFeedCategory(criteria: Partial<FeedCategory>): Promise<FeedCategory[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('feedCategory').selectAll(), criteria, feedCategoryHandlers).orderBy('id').execute();
}

const articleContentHandlers = {
  item_id: (q, v) => q.where('item_id', '=', v),
  html: (q, v) => q.where('html', '=', v),
  text: (q, v) => q.where('text', '=', v),
  word_count: (q, v) => q.where('word_count', '=', v),
  status: (q, v) => q.where('status', '=', v),
} satisfies CriteriaHandlers<'articleContent', ArticleContent>;

export async function queryArticleContent(criteria: Partial<ArticleContent>): Promise<ArticleContent[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('articleContent').selectAll(), criteria, articleContentHandlers).execute();
}

const settingHandlers = {
  key: (q, v) => q.where('key', '=', v),
  value: (q, v) => q.where('value', '=', v),
} satisfies CriteriaHandlers<'setting', Setting>;

export async function querySettings(criteria: Partial<Setting>): Promise<Setting[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('setting').selectAll(), criteria, settingHandlers).execute();
}

export async function countFeedItems(): Promise<number> {
  await dbReady;
  const { count } = await db.selectFrom('feedItem')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return count;
}

export async function countFeedMetadata(): Promise<number> {
  await dbReady;
  const { count } = await db.selectFrom('feedMetadata')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return count;
}

/**
 * Every feed placed in `workspaceId`, with its category and item counts, in one statement. No
 * items: use `queryRiverPage` for those. Scoping the join to one workspace is what keeps this one
 * row per feed even though a feed can hold a placement in several workspaces at once.
 * @param workspaceId the workspace to list feeds for
 */
export async function queryFeedSummaries(workspaceId: number): Promise<FeedSummary[]> {
  await dbReady;

  const rows = await db.selectFrom('feedMetadata as f')
    .innerJoin('feedPlacement as p', (join) => join.onRef('p.feed_id', '=', 'f.id').on('p.workspace_id', '=', workspaceId))
    .innerJoin('feedCategory as c', 'c.id', 'p.category_id')
    .leftJoin(
      (eb) => eb.selectFrom('feedItem')
        .select('feed_id')
        .select((eb2) => eb2.fn.countAll<number>().as('itemCount'))
        .select(() => sql<number>`count(*) filter (where read_at is null)`.as('unreadCount'))
        .groupBy('feed_id')
        .as('stats'),
      (join) => join.onRef('stats.feed_id', '=', 'f.id'),
    )
    .select([
      'f.id as id',
      'f.link as link',
      'f.title as title',
      'p.showInWorkspace as showInWorkspace',
      'p.workspace_id as workspaceId',
      'f.type as type',
      'f.last_fetched_at as last_fetched_at',
      'f.last_error as last_error',
      'f.icon as icon',
      'c.id as categoryId',
      'c.name as categoryName',
      'c.workspace_id as categoryWorkspaceId',
      'stats.itemCount as itemCount',
      'stats.unreadCount as unreadCount',
    ])
    .execute();

  return rows.map((row) => ({
    id: row.id,
    link: row.link,
    title: row.title,
    showInWorkspace: row.showInWorkspace,
    workspaceId: row.workspaceId,
    type: row.type,
    last_fetched_at: row.last_fetched_at,
    last_error: row.last_error,
    icon: row.icon,
    category: { id: row.categoryId, name: row.categoryName, workspace_id: row.categoryWorkspaceId },
    itemCount: row.itemCount ?? 0,
    unreadCount: row.unreadCount ?? 0,
  }));
}

/**
 * Every workspace in rail order, each with `hasUnread`: whether any of its placements (regardless
 * of `showInWorkspace`) hold an unread item. The rail shows a dot, never a number.
 */
export async function queryWorkspaceSummaries(): Promise<WorkspaceSummary[]> {
  await dbReady;

  const rows = await db.selectFrom('workspace as w')
    .leftJoin(
      (eb) => eb.selectFrom('feedPlacement as p')
        .innerJoin('feedItem as i', 'i.feed_id', 'p.feed_id')
        .select('p.workspace_id')
        .select(() => sql<number>`count(*) filter (where i.read_at is null)`.as('unreadCount'))
        .groupBy('p.workspace_id')
        .as('stats'),
      (join) => join.onRef('stats.workspace_id', '=', 'w.id'),
    )
    .select([
      'w.id as id',
      'w.name as name',
      'w.icon as icon',
      'w.color as color',
      'w.position as position',
      'w.source_slug as source_slug',
      'w.source_version as source_version',
      'w.installed_at as installed_at',
      'stats.unreadCount as unreadCount',
    ])
    .orderBy('w.position')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    position: row.position,
    source_slug: row.source_slug,
    source_version: row.source_version,
    installed_at: row.installed_at,
    hasUnread: (row.unreadCount ?? 0) > 0,
  }));
}

/** One workspace by id, or `undefined` if it does not exist. */
export async function queryWorkspaceById(workspaceId: number): Promise<Workspace | undefined> {
  await dbReady;
  return db.selectFrom('workspace').selectAll().where('id', '=', workspaceId).executeTakeFirst();
}

// Escapes SQLite LIKE wildcards so a search word is matched literally rather than as a pattern.
function escapeLikeWord(word: string): string {
  return word.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * One page of the river: every matching item, newest first, joined with its feed and category.
 * `LIMIT limit + 1` is requested so the extra row (when present) tells us whether a `nextCursor` exists,
 * without a separate count query.
 */
export async function queryRiverPage(query: RiverQuery): Promise<RiverPage> {
  await dbReady;

  let builder = db.selectFrom('feedItem as i')
    .innerJoin('feedMetadata as f', 'f.id', 'i.feed_id')
    .innerJoin('feedPlacement as p', (join) => join.onRef('p.feed_id', '=', 'f.id').on('p.workspace_id', '=', query.workspaceId))
    .innerJoin('feedCategory as c', 'c.id', 'p.category_id')
    .select([
      'i.id as id',
      'i.title as title',
      'i.link as link',
      'i.published_at as publishedAt',
      'i.excerpt as excerpt',
      'i.image as image',
      'i.read_at as readAt',
      'f.id as feedId',
      'f.title as feedTitle',
      'f.link as feedLink',
      'f.icon as feedIcon',
      'c.name as categoryName',
      'f.type as type',
    ]);

  builder = query.feedIds
    ? builder.where('f.id', 'in', query.feedIds)
    : builder.where('p.showInWorkspace', '=', 1);

  if (query.ids) {
    builder = builder.where('i.id', 'in', query.ids);
  }

  if (query.unreadOnly) {
    builder = builder.where('i.read_at', 'is', null);
  }

  const words = query.search?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  for (const word of words) {
    const pattern = `%${escapeLikeWord(word)}%`;
    builder = builder.where((eb) => eb.or([
      sql<boolean>`${eb.ref('i.title')} like ${pattern} escape '\\'`,
      sql<boolean>`${eb.ref('i.excerpt')} like ${pattern} escape '\\'`,
      sql<boolean>`${eb.ref('f.title')} like ${pattern} escape '\\'`,
    ]));
  }

  if (query.cursor) {
    const { publishedAt, id } = query.cursor;
    builder = builder.where((eb) => eb.or([
      eb('i.published_at', '<', publishedAt),
      eb.and([
        eb('i.published_at', '=', publishedAt),
        eb('i.id', '<', id),
      ]),
    ]));
  }

  const rows: RiverRow[] = await builder
    .orderBy('i.published_at', 'desc')
    .orderBy('i.id', 'desc')
    .limit(query.limit + 1)
    .execute();

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];

  return {
    rows: page,
    ...(hasMore && last ? { nextCursor: { publishedAt: last.publishedAt, id: last.id } } : {}),
  };
}
