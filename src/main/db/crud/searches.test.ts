// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { HOME_WORKSPACE_ID } from '../../../shared/contracts';
import { db, initializeDatabase } from '../database';
import { createSavedSearch, deleteSavedSearch, dismissSearchHint, listSavedSearches, updateSavedSearch } from './searches';

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('savedSearch').execute();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedPlacement').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
  await db.updateTable('workspace').set({ search_hint_dismissed_at: null }).execute();
});

let seeded = 0;

async function seedAtsFeed(titles: string[], type: 'ats' | 'rss' = 'ats'): Promise<number> {
  seeded += 1;
  const category = await db.insertInto('feedCategory').values({ name: `jobs-${seeded}`, workspace_id: HOME_WORKSPACE_ID }).returning('id').executeTakeFirstOrThrow();
  const feed = await db.insertInto('feedMetadata').values({ link: `https://jobs.example/${type}-${seeded}`, title: 'Acme · Jobs', type }).returning('id').executeTakeFirstOrThrow();
  await db.insertInto('feedPlacement').values({ feed_id: feed.id, category_id: category.id, workspace_id: HOME_WORKSPACE_ID, showInWorkspace: 1 }).execute();
  for (const [index, title] of titles.entries()) {
    await db.insertInto('feedItem').values({ feed_id: feed.id, title, guid: `g${index}`, link: undefined, pubDate: '', description: '', published_at: index }).execute();
  }
  return feed.id;
}

describe('saved search CRUD', () => {
  test('creates searches in order and lists them with their unread counts', async () => {
    // Arrange
    const feedId = await seedAtsFeed(['Backend Engineer', 'Frontend Engineer', 'Designer']);
    await db.updateTable('feedItem').set({ read_at: '2024-01-01' }).where('title', '=', 'Backend Engineer').execute();
    await createSavedSearch(HOME_WORKSPACE_ID, 'Engineers', 'title:engineer');
    await createSavedSearch(HOME_WORKSPACE_ID, 'Designers', 'title:designer');

    // Act
    const { searches } = await listSavedSearches(HOME_WORKSPACE_ID);

    // Assert
    expect(feedId).toBeGreaterThan(0);
    expect(searches.map((search) => [search.name, search.position, search.unreadCount])).toEqual([['Engineers', 0, 1], ['Designers', 1, 1]]);
  });

  test('refuses a duplicate name in the same workspace but not in another', async () => {
    // Arrange
    const other = await db.insertInto('workspace').values({ name: 'Jobs', icon: 'Stars01', color: '#000000', position: 1 }).returning('id').executeTakeFirstOrThrow();
    await createSavedSearch(HOME_WORKSPACE_ID, 'Engineers', 'engineer');

    // Act
    const duplicate = await createSavedSearch(HOME_WORKSPACE_ID, ' Engineers ', 'other');
    const elsewhere = await createSavedSearch(other.id, 'Engineers', 'engineer');

    // Assert
    expect(duplicate).toMatchObject({ success: false, error: { name: 'DUPLICATE_NAME' } });
    expect(elsewhere.success).toBe(true);
  });

  test('rejects an empty name, an empty query and an unknown workspace', async () => {
    // Act / Assert
    expect(await createSavedSearch(HOME_WORKSPACE_ID, '  ', 'q')).toMatchObject({ error: { name: 'INVALID_INPUT' } });
    expect(await createSavedSearch(HOME_WORKSPACE_ID, 'n', ' ')).toMatchObject({ error: { name: 'INVALID_INPUT' } });
    expect(await createSavedSearch(9999, 'n', 'q')).toMatchObject({ error: { name: 'WORKSPACE_NOT_FOUND' } });
  });

  test('updates the name or the query, and reports a missing search or a taken name', async () => {
    // Arrange
    const created = await createSavedSearch(HOME_WORKSPACE_ID, 'Engineers', 'engineer');
    await createSavedSearch(HOME_WORKSPACE_ID, 'Designers', 'designer');
    const id = created.success ? created.data.id : 0;

    // Act
    const renamed = await updateSavedSearch(id, { name: 'Devs' });
    const requeried = await updateSavedSearch(id, { query: 'developer' });
    const taken = await updateSavedSearch(id, { name: 'Designers' });
    const missing = await updateSavedSearch(9999, { name: 'x' });
    const untouched = await updateSavedSearch(id, {});

    // Assert
    expect(renamed).toMatchObject({ success: true, data: { name: 'Devs', query: 'engineer' } });
    expect(requeried).toMatchObject({ success: true, data: { name: 'Devs', query: 'developer' } });
    expect(taken).toMatchObject({ error: { name: 'DUPLICATE_NAME' } });
    expect(missing).toMatchObject({ error: { name: 'SEARCH_NOT_FOUND' } });
    expect(untouched).toMatchObject({ success: true, data: { name: 'Devs' } });
  });

  test('deletes a search once and reports it missing the second time', async () => {
    // Arrange
    const created = await createSavedSearch(HOME_WORKSPACE_ID, 'Engineers', 'engineer');
    const id = created.success ? created.data.id : 0;

    // Act
    const first = await deleteSavedSearch(id);
    const second = await deleteSavedSearch(id);

    // Assert
    expect(first.success).toBe(true);
    expect(second).toMatchObject({ error: { name: 'SEARCH_NOT_FOUND' } });
  });

  test('cascades on workspace delete', async () => {
    // Arrange
    const other = await db.insertInto('workspace').values({ name: 'Jobs', icon: 'Stars01', color: '#000000', position: 1 }).returning('id').executeTakeFirstOrThrow();
    await createSavedSearch(other.id, 'Engineers', 'engineer');

    // Act
    await db.deleteFrom('workspace').where('id', '=', other.id).execute();

    // Assert
    expect(await db.selectFrom('savedSearch').selectAll().execute()).toEqual([]);
  });
});

describe('search hint', () => {
  test('offers an example only for a workspace with an ats feed, no saved search and no dismissal', async () => {
    // Arrange
    await seedAtsFeed(['Data Analyst', 'Data Analyst II', 'Product Designer']);

    // Act
    const hint = await listSavedSearches(HOME_WORKSPACE_ID);
    await createSavedSearch(HOME_WORKSPACE_ID, 'Analysts', 'analyst');
    const afterSave = await listSavedSearches(HOME_WORKSPACE_ID);

    // Assert
    expect(hint.hintExample).toBe('title:"data analyst" -senior');
    expect(afterSave.hintExample).toBeUndefined();
  });

  test('picks the example from the most common role word', async () => {
    // Arrange
    await seedAtsFeed(['Software Engineer', 'Backend Engineer', 'Designer']);

    // Act
    const { hintExample } = await listSavedSearches(HOME_WORKSPACE_ID);

    // Assert
    expect(hintExample).toBe('title:engineer -manager');
  });

  test('offers a default example before the first job arrives, and none without an ats feed', async () => {
    // Arrange
    await seedAtsFeed([]);
    const withFeed = await listSavedSearches(HOME_WORKSPACE_ID);
    await db.deleteFrom('feedPlacement').execute();
    await db.deleteFrom('feedMetadata').execute();
    await seedAtsFeed(['Engineer'], 'rss');

    // Act
    const withoutAts = await listSavedSearches(HOME_WORKSPACE_ID);

    // Assert
    expect(withFeed.hintExample).toBeDefined();
    expect(withoutAts.hintExample).toBeUndefined();
  });

  test('stays hidden once dismissed', async () => {
    // Arrange
    await seedAtsFeed(['Engineer']);

    // Act
    const dismissed = await dismissSearchHint(HOME_WORKSPACE_ID);
    const { hintExample } = await listSavedSearches(HOME_WORKSPACE_ID);

    // Assert
    expect(dismissed.success).toBe(true);
    expect(hintExample).toBeUndefined();
  });

  test('reports a missing workspace on dismiss', async () => {
    // Act
    const result = await dismissSearchHint(9999);

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'WORKSPACE_NOT_FOUND' } });
  });
});
