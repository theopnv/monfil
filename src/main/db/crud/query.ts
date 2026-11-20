// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { sql, type SelectQueryBuilder } from 'kysely';
import { type ArticleContent, type Database, type FeedItem, type FeedMetadataRow, type Setting } from '../types';
import { db, dbReady } from '../database';
import { searchCondition } from '../search';
import { parseErrorParams } from '../error-params';
import { paginate } from '../paging';
import type { FeedCategory, FeedSummary, JobDetails, RiverPage, RiverQuery, Workspace, WorkspaceSummary } from '../../../shared/contracts';

/** Filters on equality of every field the criteria set. The row type decides which fields exist, so a new column is queryable with no further change. */
function applyCriteria<TB extends keyof Database, T>(
  query: SelectQueryBuilder<Database, TB, T>,
  criteria: Partial<T>,
): SelectQueryBuilder<Database, TB, T> {
  let result = query;
  for (const [key, value] of Object.entries(criteria)) {
    if (value !== undefined) {
      result = result.where(sql.ref(key), '=', value);
    }
  }
  return result;
}

// Ordered explicitly: without it SQLite returns rows in whatever order the chosen index gives,
// which the UNIQUE(feed_id, guid) index made "by guid" rather than the insertion order callers expect.
export async function queryFeedItems(criteria: Partial<FeedItem>): Promise<FeedItem[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('feedItem').selectAll(), criteria).orderBy('id').execute();
}

export async function queryFeedMetadata(criteria: Partial<FeedMetadataRow>): Promise<FeedMetadataRow[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('feedMetadata').selectAll(), criteria).execute();
}

export async function querySubscribedFeedMetadata(ids?: number[]): Promise<FeedMetadataRow[]> {
  await dbReady;
  let builder = db.selectFrom('feedMetadata').selectAll()
    .where((eb) => eb.exists(eb.selectFrom('feedPlacement').select('feed_id').whereRef('feedPlacement.feed_id', '=', 'feedMetadata.id')));
  if (ids) {
    builder = builder.where('id', 'in', ids);
  }
  return builder.execute();
}

/** Every stored feed whose id is in `ids`, in no particular order. Used to refresh a specific batch (e.g. a freshly imported OPML) rather than every feed. */
export async function queryFeedMetadataByIds(ids: number[]): Promise<FeedMetadataRow[]> {
  await dbReady;
  // Stryker disable next-line BlockStatement: an empty IN list matches no row, so the query returns the same empty array
  if (ids.length === 0) {
    return [];
  }
  return db.selectFrom('feedMetadata').selectAll().where('id', 'in', ids).execute();
}

// Ordered explicitly, same reasoning as queryFeedItems: filtering by workspace_id lets SQLite
// satisfy the query from the (workspace_id, name) unique index, which returns rows alphabetically
// by name rather than in creation order once that index is used instead of a full table scan.
export async function queryFeedCategory(criteria: Partial<FeedCategory>): Promise<FeedCategory[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('feedCategory').selectAll(), criteria).orderBy('id').execute();
}

export async function queryArticleContent(criteria: Partial<ArticleContent>): Promise<ArticleContent[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('articleContent').selectAll(), criteria).execute();
}

export async function querySettings(criteria: Partial<Setting>): Promise<Setting[]> {
  await dbReady;
  return applyCriteria(db.selectFrom('setting').selectAll(), criteria).execute();
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
    .select((eb) => eb.selectFrom('feedPlacement as other')
      .select((eb2) => eb2.fn.countAll<number>().as('count'))
      .whereRef('other.feed_id', '=', 'f.id')
      .where('other.workspace_id', '!=', workspaceId)
      .as('otherWorkspaceCount'))
    .select([
      'f.id as id',
      'f.link as link',
      'f.title as title',
      'p.showInWorkspace as showInWorkspace',
      'p.workspace_id as workspaceId',
      'f.type as type',
      'f.last_fetched_at as last_fetched_at',
      'f.last_error as last_error',
      'f.last_error_code as last_error_code',
      'f.last_error_params as last_error_params',
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
    last_error_code: row.last_error_code,
    last_error_params: parseErrorParams(row.last_error_params),
    icon: row.icon,
    category: { id: row.categoryId, name: row.categoryName, workspace_id: row.categoryWorkspaceId },
    itemCount: row.itemCount ?? 0,
    unreadCount: row.unreadCount ?? 0,
    otherWorkspaceCount: row.otherWorkspaceCount ?? 0,
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

export async function queryWorkspaceById(workspaceId: number): Promise<Workspace | undefined> {
  await dbReady;
  return db.selectFrom('workspace').selectAll().where('id', '=', workspaceId).executeTakeFirst();
}

function riverItems(query: Pick<RiverQuery, 'workspaceId' | 'feedIds' | 'ids' | 'unreadOnly' | 'search'>) {
  let builder = db.selectFrom('feedItem as i')
    .innerJoin('feedMetadata as f', 'f.id', 'i.feed_id')
    .innerJoin('feedPlacement as p', (join) => join.onRef('p.feed_id', '=', 'f.id').on('p.workspace_id', '=', query.workspaceId))
    .innerJoin('feedCategory as c', 'c.id', 'p.category_id')
    .leftJoin('savedItem as s', (join) => join.onRef('s.item_id', '=', 'i.id').on('s.workspace_id', '=', query.workspaceId));

  builder = query.feedIds
    ? builder.where('f.id', 'in', query.feedIds)
    : builder.where('p.showInWorkspace', '=', 1);

  if (query.ids) {
    builder = builder.where('i.id', 'in', query.ids);
  }

  if (query.unreadOnly) {
    builder = builder.where('i.read_at', 'is', null);
  }

  const search = searchCondition(query.search);
  return search ? builder.where(search) : builder;
}

/** How many unread items match `query`, through the same filters as `queryRiverPage` so a count and its page always agree. */
export async function countUnreadRiverItems(query: Pick<RiverQuery, 'workspaceId' | 'feedIds' | 'search'>): Promise<number> {
  await dbReady;
  const { count } = await riverItems({ ...query, unreadOnly: true })
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return count;
}

function toJobDetails(extra: string | undefined): JobDetails | undefined {
  if (!extra) {
    return undefined;
  }
  try {
    const raw: unknown = JSON.parse(extra);
    if (typeof raw !== 'object' || raw === null) {
      return undefined;
    }
    const field = (key: string): string | undefined => {
      const value: unknown = (raw as Record<string, unknown>)[key];
      return typeof value === 'string' && value !== '' ? value : undefined;
    };
    return { company: field('company'), location: field('location'), workMode: field('workMode'), salaryLabel: field('salaryLabel') };
  } catch {
    return undefined;
  }
}

/**
 * One page of the river: every matching item, newest first, joined with its feed and category.
 * `LIMIT limit + 1` is requested so the extra row (when present) tells us whether a `nextCursor` exists,
 * without a separate count query.
 */
export async function queryRiverPage(query: RiverQuery): Promise<RiverPage> {
  await dbReady;

  let builder = riverItems(query)
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
      's.saved_at as savedAt',
    ])
    .select(sql<string | null>`case when f.type = 'ats' then i.extra end`.as('extra'));

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

  const rows = await builder
    .orderBy('i.published_at', 'desc')
    .orderBy('i.id', 'desc')
    .limit(query.limit + 1)
    .execute();

  const { page, last } = paginate(rows, query.limit);

  return {
    rows: page.map(({ extra, ...row }) => {
      const job = row.type === 'ats' ? toJobDetails(extra ?? undefined) : undefined;
      return { ...row, savedAt: row.savedAt ?? undefined, ...(job ? { job } : {}) };
    }),
    ...(last ? { nextCursor: { publishedAt: last.publishedAt, id: last.id } } : {}),
  };
}
