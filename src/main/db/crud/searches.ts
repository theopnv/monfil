// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { db, dbReady } from '../database';
import { countUnreadRiverItems } from './query';
import type { SavedSearch, SavedSearchError, SavedSearchList, UpdateWorkspaceError } from '../../../shared/contracts';
import { pickHintExample } from '../../../shared/search-hint';
import type { Result } from '../../../shared/result';

const MAX_NAME_LENGTH = 60;
const MAX_QUERY_LENGTH = 500;
const HINT_TITLE_SAMPLE = 2000;

function failure(error: SavedSearchError): { success: false; error: SavedSearchError } {
  return { success: false, error };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function toFailure(error: unknown, duplicateName?: string): { success: false; error: SavedSearchError } {
  if (isUniqueViolation(error)) {
    return failure({ name: 'DUPLICATE_NAME', message: `A saved search named "${duplicateName ?? ''}" already exists.` });
  }
  return failure({ name: 'DB_ERROR', message: error instanceof Error ? error.message : 'The saved search could not be stored.' });
}

function validate(name: string | undefined, query: string | undefined): SavedSearchError | undefined {
  if (name !== undefined && (name.trim() === '' || name.trim().length > MAX_NAME_LENGTH)) {
    return { name: 'INVALID_INPUT', message: `A name needs 1 to ${MAX_NAME_LENGTH} characters.` };
  }
  if (query !== undefined && (query.trim() === '' || query.trim().length > MAX_QUERY_LENGTH)) {
    return { name: 'INVALID_INPUT', message: `A search needs 1 to ${MAX_QUERY_LENGTH} characters.` };
  }
  return undefined;
}

async function hintExampleFor(workspaceId: number, hintDismissed: boolean): Promise<string | undefined> {
  if (hintDismissed) {
    return undefined;
  }
  const titles = await db.selectFrom('feedItem as i')
    .innerJoin('feedMetadata as f', 'f.id', 'i.feed_id')
    .innerJoin('feedPlacement as p', (join) => join.onRef('p.feed_id', '=', 'f.id').on('p.workspace_id', '=', workspaceId))
    .where('f.type', '=', 'ats')
    .select('i.title')
    .orderBy('i.id', 'desc')
    .limit(HINT_TITLE_SAMPLE)
    .execute();
  if (titles.length > 0) {
    return pickHintExample(titles.map((row) => row.title));
  }
  const hasAtsFeed = await db.selectFrom('feedMetadata as f')
    .innerJoin('feedPlacement as p', (join) => join.onRef('p.feed_id', '=', 'f.id').on('p.workspace_id', '=', workspaceId))
    .where('f.type', '=', 'ats')
    .select('f.id')
    .limit(1)
    .executeTakeFirst();
  return hasAtsFeed ? pickHintExample([]) : undefined;
}

/**
 * The saved searches of a workspace in pill order, each with its unread count, plus the example for the
 * onboarding hint when it applies.
 */
export async function listSavedSearches(workspaceId: number): Promise<SavedSearchList> {
  await dbReady;
  const rows = await db.selectFrom('savedSearch').selectAll().where('workspace_id', '=', workspaceId).orderBy('position').orderBy('id').execute();
  const searches = await Promise.all(rows.map(async (row) => ({
    ...row,
    unreadCount: await countUnreadRiverItems({ workspaceId, search: row.query }),
  })));
  if (searches.length > 0) {
    return { searches, hintExample: undefined };
  }
  const workspace = await db.selectFrom('workspace').select('search_hint_dismissed_at').where('id', '=', workspaceId).executeTakeFirst();
  const dismissed = !workspace || workspace.search_hint_dismissed_at != null;
  return { searches, hintExample: await hintExampleFor(workspaceId, dismissed) };
}

export async function createSavedSearch(workspaceId: number, name: string, query: string, now = Date.now()): Promise<Result<SavedSearch, SavedSearchError>> {
  const invalid = validate(name, query);
  if (invalid) {
    return failure(invalid);
  }
  await dbReady;
  try {
    return await db.transaction().execute(async (trx): Promise<Result<SavedSearch, SavedSearchError>> => {
      const workspace = await trx.selectFrom('workspace').select('id').where('id', '=', workspaceId).executeTakeFirst();
      if (!workspace) {
        return failure({ name: 'WORKSPACE_NOT_FOUND', message: 'The workspace could not be found.' });
      }
      const { maxPosition } = await trx.selectFrom('savedSearch')
        .select((eb) => eb.fn.max('position').as('maxPosition'))
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirstOrThrow();
      const created = await trx.insertInto('savedSearch')
        .values({ workspace_id: workspaceId, name: name.trim(), query: query.trim(), position: (maxPosition ?? -1) + 1, created_at: now })
        .returningAll()
        .executeTakeFirstOrThrow();
      return { success: true, data: created };
    });
  } catch (error) {
    return toFailure(error, name.trim());
  }
}

export async function updateSavedSearch(searchId: number, patch: { name?: string; query?: string }): Promise<Result<SavedSearch, SavedSearchError>> {
  const invalid = validate(patch.name, patch.query);
  if (invalid) {
    return failure(invalid);
  }
  await dbReady;
  try {
    const values = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.query !== undefined ? { query: patch.query.trim() } : {}),
    };
    const updated = Object.keys(values).length === 0
      ? await db.selectFrom('savedSearch').selectAll().where('id', '=', searchId).executeTakeFirst()
      : await db.updateTable('savedSearch').set(values).where('id', '=', searchId).returningAll().executeTakeFirst();
    return updated ? { success: true, data: updated } : failure({ name: 'SEARCH_NOT_FOUND', message: 'The saved search could not be found.' });
  } catch (error) {
    return toFailure(error, patch.name?.trim());
  }
}

export async function deleteSavedSearch(searchId: number): Promise<Result<void, SavedSearchError>> {
  await dbReady;
  try {
    const result = await db.deleteFrom('savedSearch').where('id', '=', searchId).executeTakeFirst();
    return result.numDeletedRows === 0n
      ? failure({ name: 'SEARCH_NOT_FOUND', message: 'The saved search could not be found.' })
      : { success: true, data: undefined };
  } catch (error) {
    return toFailure(error);
  }
}

export async function dismissSearchHint(workspaceId: number, now = new Date()): Promise<Result<void, UpdateWorkspaceError>> {
  await dbReady;
  try {
    const result = await db.updateTable('workspace').set({ search_hint_dismissed_at: now.toISOString() }).where('id', '=', workspaceId).executeTakeFirst();
    return result.numUpdatedRows === 0n
      ? { success: false, error: { name: 'WORKSPACE_NOT_FOUND', message: `No workspace found with id ${workspaceId}` } }
      : { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
