// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test } from 'vitest';
import { HOME_WORKSPACE_ID } from '../../../shared/contracts';
import { db } from '../database';
import { countUnreadRiverItems, queryFeedCategory, queryFeedItems, queryFeedMetadata, queryFeedMetadataByIds, queryFeedSummaries, queryRiverPage } from './query';
import { useTestDatabase } from '../../test/db';

useTestDatabase();


describe('queryFeedCategory', () => {

  test('filters by name', async () => {
    // Arrange
    await db.insertInto('feedCategory').values([{ name: 'tech', workspace_id: HOME_WORKSPACE_ID }, { name: 'news', workspace_id: HOME_WORKSPACE_ID }]).execute();

    // Act
    const result = await queryFeedCategory({ name: 'tech' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('tech');
  });
});

describe('queryFeedMetadata', () => {
  beforeEach(async () => {
    await db
      .insertInto('feedMetadata')
      .values([
        { link: 'https://a.example/feed', title: 'Feed A' },
        { link: 'https://b.example/feed', title: 'Feed B' },
      ])
      .execute();
  });

  test('filters by link', async () => {
    // Act
    const result = await queryFeedMetadata({ link: 'https://a.example/feed' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Feed A');
  });

  test('filters by title', async () => {
    // Act
    const result = await queryFeedMetadata({ title: 'Feed B' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.link).toBe('https://b.example/feed');
  });
});

describe('queryFeedMetadata with unset criteria', () => {
  test('ignores a criterion whose value is undefined', async () => {
    // Arrange
    await db.insertInto('feedMetadata').values([{ link: 'https://a.example/feed', title: 'Feed A' }, { link: 'https://b.example/feed', title: 'Feed B' }]).execute();

    // Act
    const result = await queryFeedMetadata({ title: 'Feed B', icon: undefined });

    // Assert
    expect(result.map((row) => row.link)).toEqual(['https://b.example/feed']);
  });
});

describe('queryFeedMetadataByIds', () => {
  test('returns the stored feeds with the given ids, and nothing for an empty list', async () => {
    // Arrange
    const first = await seedFeed({ link: 'https://a.example/feed' });
    await seedFeed({ link: 'https://b.example/feed' });

    // Act
    const found = await queryFeedMetadataByIds([first]);
    const none = await queryFeedMetadataByIds([]);

    // Assert
    expect(found.map((row) => row.id)).toEqual([first]);
    expect(none).toEqual([]);
  });
});

describe('queryFeedItems', () => {
  let feed: { id: number; };

  beforeEach(async () => {
    feed = await db
      .insertInto('feedMetadata')
      .values({ link: 'https://a.example/feed', title: 'Feed A' })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await db
      .insertInto('feedItem')
      .values([
        { feed_id: feed.id, title: 'Item 1', link: 'https://a.example/1', guid: 'https://a.example/1', pubDate: '2024-01-01', description: 'Description 1' },
        { feed_id: feed.id, title: 'Item 2', link: 'https://a.example/2', guid: 'https://a.example/2', pubDate: '2024-01-02', description: 'Description 2' },
      ])
      .execute();
  });

  test('filters by title', async () => {
    // Act
    const result = await queryFeedItems({ title: 'Item 1' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.link).toBe('https://a.example/1');
  });

  test('filters by link', async () => {
    // Act
    const result = await queryFeedItems({ link: 'https://a.example/2' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Item 2');
  });

  test('filters by pubDate', async () => {
    // Act
    const result = await queryFeedItems({ pubDate: '2024-01-01' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Item 1');
  });

  test('returns an empty array when nothing matches', async () => {
    // Act
    const result = await queryFeedItems({ title: 'does-not-exist' });

    // Assert
    expect(result).toEqual([]);
  });
});

async function seedFeed(overrides: Partial<{ title: string; link: string; showInWorkspace: number; categoryName: string; workspaceId: number }> = {}): Promise<number> {
  const workspaceId = overrides.workspaceId ?? HOME_WORKSPACE_ID;
  const category = await db.insertInto('feedCategory')
    .values({ name: overrides.categoryName ?? 'tech', workspace_id: workspaceId })
    .onConflict((oc) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
    .returning(['id'])
    .executeTakeFirstOrThrow();
  const feed = await db.insertInto('feedMetadata')
    .values({
      link: overrides.link ?? 'https://a.example/feed',
      title: overrides.title ?? 'Feed A',
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  await db.insertInto('feedPlacement')
    .values({ feed_id: feed.id, category_id: category.id, workspace_id: workspaceId, showInWorkspace: overrides.showInWorkspace ?? 1 })
    .onConflict((oc) => oc.columns(['feed_id', 'workspace_id']).doUpdateSet((eb) => ({
      category_id: eb.ref('excluded.category_id'),
      showInWorkspace: eb.ref('excluded.showInWorkspace'),
    })))
    .execute();
  return feed.id;
}

let seedItemCounter = 0;

async function seedItem(feedId: number, overrides: Partial<{ title: string; publishedAt: number; excerpt: string; readAt: string; description: string }> = {}): Promise<number> {
  seedItemCounter += 1;
  const guid = `guid-${seedItemCounter}`;
  const item = await db.insertInto('feedItem')
    .values({
      feed_id: feedId,
      title: overrides.title ?? 'Item',
      link: `https://a.example/${guid}`,
      guid,
      pubDate: '2024-01-01',
      description: overrides.description ?? '',
      published_at: overrides.publishedAt ?? 0,
      excerpt: overrides.excerpt ?? '',
      read_at: overrides.readAt,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return item.id;
}

describe('queryFeedSummaries', () => {

  test('returns the error code and the parsed params of the last failed refresh', async () => {
    // Arrange
    const feedId = await seedFeed();
    await db.updateTable('feedMetadata')
      .set({ last_error: 'The server had an error (HTTP 502).', last_error_code: 'GENERIC_FETCH_ERROR', last_error_params: '{"reason":"serverError","status":502}' })
      .where('id', '=', feedId)
      .execute();

    // Act
    const [summary] = await queryFeedSummaries(HOME_WORKSPACE_ID);

    // Assert
    expect(summary).toMatchObject({ last_error: 'The server had an error (HTTP 502).', last_error_code: 'GENERIC_FETCH_ERROR', last_error_params: { reason: 'serverError', status: 502 } });
  });
});

describe('queryRiverPage', () => {
  test('returns rows newest first, with a cursor when more remain', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Oldest', publishedAt: 1 });
    await seedItem(feedId, { title: 'Middle', publishedAt: 2 });
    await seedItem(feedId, { title: 'Newest', publishedAt: 3 });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 2 });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Newest', 'Middle']);
    expect(page.nextCursor).toEqual({ publishedAt: 2, id: page.rows[1]?.id });
  });

  test('continues from a cursor without repeating or skipping rows', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Oldest', publishedAt: 1 });
    await seedItem(feedId, { title: 'Middle', publishedAt: 2 });
    await seedItem(feedId, { title: 'Newest', publishedAt: 3 });
    const firstPage = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 2 });

    // Act
    const secondPage = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 2, ...(firstPage.nextCursor ? { cursor: firstPage.nextCursor } : {}) });

    // Assert
    expect(secondPage.rows.map((row) => row.title)).toEqual(['Oldest']);
    expect(secondPage.nextCursor).toBeUndefined();
  });

  test('omits the cursor when exactly `limit` rows remain', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { publishedAt: 1 });
    await seedItem(feedId, { publishedAt: 2 });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 2 });

    // Assert
    expect(page.rows).toHaveLength(2);
    expect(page.nextCursor).toBeUndefined();
  });

  test('breaks a tie on the same published_at by id, descending', async () => {
    // Arrange
    const feedId = await seedFeed();
    const firstId = await seedItem(feedId, { title: 'First inserted', publishedAt: 5 });
    const secondId = await seedItem(feedId, { title: 'Second inserted', publishedAt: 5 });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10 });

    // Assert
    expect(page.rows.map((row) => row.id)).toEqual([secondId, firstId]);
  });

  test('filters to the given feed ids', async () => {
    // Arrange
    const feedA = await seedFeed({ link: 'https://a.example/feed', title: 'Feed A' });
    const feedB = await seedFeed({ link: 'https://b.example/feed', title: 'Feed B' });
    await seedItem(feedA, { title: 'From A' });
    await seedItem(feedB, { title: 'From B' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, feedIds: [feedA] });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['From A']);
  });

  test('defaults to feeds with showInWorkspace when no feedIds are given', async () => {
    // Arrange
    const shown = await seedFeed({ link: 'https://a.example/feed', title: 'Shown', showInWorkspace: 1 });
    const hidden = await seedFeed({ link: 'https://b.example/feed', title: 'Hidden', showInWorkspace: 0 });
    await seedItem(shown, { title: 'Visible' });
    await seedItem(hidden, { title: 'Not visible' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10 });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Visible']);
  });

  test('filters to exact ids regardless of the default feed filter', async () => {
    // Arrange
    const feedId = await seedFeed({ showInWorkspace: 0 });
    const targetId = await seedItem(feedId, { title: 'Deep link target' });
    await seedItem(feedId, { title: 'Not requested' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, feedIds: [feedId], ids: [targetId] });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Deep link target']);
  });

  test('filters to unread items only', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Read', readAt: '2024-01-02T00:00:00.000Z' });
    await seedItem(feedId, { title: 'Unread' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, unreadOnly: true });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Unread']);
  });

  test('requires every search word to match', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Rust programming', excerpt: 'a systems language' });
    await seedItem(feedId, { title: 'Rust only' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search: 'rust systems' });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Rust programming']);
  });

  test('matches a search word against the feed title alone', async () => {
    // Arrange
    const feedId = await seedFeed({ title: 'Distinctive Feed Name' });
    await seedItem(feedId, { title: 'Unrelated title', excerpt: 'unrelated excerpt' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search: 'distinctive' });

    // Assert
    expect(page.rows).toHaveLength(1);
  });

  test('treats % in the search string as a literal character', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: '50% off sale' });
    await seedItem(feedId, { title: 'Full price' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search: '50%' });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['50% off sale']);
  });

  test('supports phrases, OR, exclusions and title: together', async () => {
    // Arrange
    const feedId = await seedFeed({ title: 'Acme Jobs' });
    await seedItem(feedId, { title: 'Data Analyst', excerpt: 'sql and python' });
    await seedItem(feedId, { title: 'Senior Data Analyst', excerpt: 'sql' });
    await seedItem(feedId, { title: 'Data Engineer', excerpt: 'we need a data analyst friend' });
    await seedItem(feedId, { title: 'Product Designer', excerpt: 'figma' });
    const titles = async (search: string) => (await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search })).rows.map((row) => row.title).sort();

    // Act / Assert
    expect(await titles('"data analyst"')).toEqual(['Data Analyst', 'Data Engineer', 'Senior Data Analyst']);
    expect(await titles('title:"data analyst"')).toEqual(['Data Analyst', 'Senior Data Analyst']);
    expect(await titles('title:"data analyst" -senior')).toEqual(['Data Analyst']);
    expect(await titles('designer OR engineer')).toEqual(['Data Engineer', 'Product Designer']);
    expect(await titles('-data')).toEqual(['Product Designer']);
    expect(await titles('title:acme')).toEqual([]);
    expect(await titles('acme -senior -engineer')).toEqual(['Data Analyst', 'Product Designer']);
  });

  test('matches a short bare word as a whole word, and a quoted one as a substring', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'CI Engineer' });
    await seedItem(feedId, { title: 'Producing Assistant' });
    await seedItem(feedId, { title: 'Senior (CI/CD) Lead' });
    const titles = async (search: string) => (await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search })).rows.map((row) => row.title).sort();

    // Act / Assert
    expect(await titles('ci')).toEqual(['CI Engineer', 'Senior (CI/CD) Lead']);
    expect(await titles('"ci"')).toEqual(['CI Engineer', 'Producing Assistant', 'Senior (CI/CD) Lead']);
    expect(await titles('title:ci -lead')).toEqual(['CI Engineer']);
    expect(await titles('produc')).toEqual(['Producing Assistant']);
  });

  test('searches the place and work mode of a job, and a negated place keeps other items', async () => {
    // Arrange
    const jobs = await seedFeed({ title: 'Acme · Jobs', link: 'https://api.lever.co/v0/postings/acme?mode=json' });
    await db.updateTable('feedMetadata').set({ type: 'ats' }).where('id', '=', jobs).execute();
    const paris = await seedItem(jobs, { title: 'Engineer' });
    const dublin = await seedItem(jobs, { title: 'Analyst' });
    await db.updateTable('feedItem').set({ extra: JSON.stringify({ location: 'Paris, France', workMode: 'hybrid' }) }).where('id', '=', paris).execute();
    await db.updateTable('feedItem').set({ extra: JSON.stringify({ location: 'Dublin', workMode: 'remote' }) }).where('id', '=', dublin).execute();
    const blog = await seedFeed({ link: 'https://blog.example/feed' });
    await seedItem(blog, { title: 'A blog post' });
    const titles = async (search: string) => (await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search })).rows.map((row) => row.title).sort();

    // Act / Assert
    expect(await titles('paris')).toEqual(['Engineer']);
    expect(await titles('remote')).toEqual(['Analyst']);
    expect(await titles('-paris')).toEqual(['A blog post', 'Analyst']);
    expect(await titles('title:paris')).toEqual([]);
  });

  test('counts unread matches with the same filters as the page', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Data Analyst' });
    await seedItem(feedId, { title: 'Data Analyst II', readAt: '2024-01-01' });
    await seedItem(feedId, { title: 'Designer' });
    const search = 'title:"data analyst"';

    // Act
    const count = await countUnreadRiverItems({ workspaceId: HOME_WORKSPACE_ID, search });
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search, unreadOnly: true });

    // Assert
    expect(count).toBe(1);
    expect(page.rows).toHaveLength(count);
  });

  test('fills job details for ats items only', async () => {
    // Arrange
    const feedId = await seedFeed();
    const itemId = await seedItem(feedId, { title: 'Engineer' });
    const extra = JSON.stringify({ company: 'Acme', location: 'Paris', workMode: 'hybrid', salaryLabel: '€60k–€75k' });
    await db.updateTable('feedItem').set({ extra }).where('id', '=', itemId).execute();

    // Act
    const before = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10 });
    await db.updateTable('feedMetadata').set({ type: 'ats' }).where('id', '=', feedId).execute();
    const after = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10 });

    // Assert
    expect(before.rows[0]?.job).toBeUndefined();
    expect(after.rows[0]?.job).toEqual({ company: 'Acme', location: 'Paris', workMode: 'hybrid', salaryLabel: '€60k–€75k' });
  });

  test.each([
    ['a percent sign', '5%'],
    ['an underscore', 'sale_'],
  ])('does not treat %s in the search string as a wildcard', async (_name, search) => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: '50% off sale' });

    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10, search });

    // Assert
    expect(page.rows).toEqual([]);
  });

  test('returns an empty page for an empty database', async () => {
    // Act
    const page = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10 });

    // Assert
    expect(page).toEqual({ rows: [] });
  });

  test('returns an item exactly once per workspace it is placed in', async () => {
    // Arrange
    const feedId = await seedFeed({ title: 'Shared feed' });
    await seedItem(feedId, { title: 'Shared item' });

    const otherWorkspace = await db.insertInto('workspace')
      .values({ name: 'Pack', icon: 'Stars01', color: '#000000', position: 1 })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    const otherCategory = await db.insertInto('feedCategory')
      .values({ name: 'tech', workspace_id: otherWorkspace.id })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    await db.insertInto('feedPlacement')
      .values({ feed_id: feedId, category_id: otherCategory.id, workspace_id: otherWorkspace.id, showInWorkspace: 1 })
      .execute();

    // Act
    const homePage = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 10 });
    const otherPage = await queryRiverPage({ workspaceId: otherWorkspace.id, limit: 10 });

    // Assert
    expect(homePage.rows.map((row) => row.title)).toEqual(['Shared item']);
    expect(otherPage.rows.map((row) => row.title)).toEqual(['Shared item']);
  });
});
