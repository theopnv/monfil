// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator, NO_MIGRATIONS, type MigrationResultSet } from 'kysely/migration';
import { migrationProvider } from './index.ts';
import { HOME_WORKSPACE_ID } from '../types.ts';
import { rmTestDir } from '../../lib/rmTestDir';

// A real file rather than ':memory:', so the table rebuilds run the way they will run on a user's install.
let dir: string;
let sqlite: SQLite.Database;
let db: Kysely<any>;
let migrator: Migrator;

const migrationNames = Object.keys(await migrationProvider.getMigrations());

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'monfil-db-'));
  sqlite = new SQLite(path.join(dir, 'monfil.db'));
  sqlite.pragma('foreign_keys = ON');
  db = new Kysely<any>({ dialect: new SqliteDialect({ database: sqlite }) });
  migrator = new Migrator({ db, provider: migrationProvider });
});

afterEach(async () => {
  await db.destroy();
  await rmTestDir(dir);
});

// Mirrors openAndMigrate's foreign_keys OFF -> migrate -> ON: a table rebuild fires a parent's
// cascade actions through DROP TABLE's implicit DELETE FROM when foreign keys are enforced.
async function migrateTo(target: Parameters<Migrator['migrateTo']>[0]): Promise<MigrationResultSet> {
  sqlite.pragma('foreign_keys = OFF');
  const result = await migrator.migrateTo(target);
  sqlite.pragma('foreign_keys = ON');
  return result;
}

async function migrateToLatest(): Promise<MigrationResultSet> {
  sqlite.pragma('foreign_keys = OFF');
  const result = await migrator.migrateToLatest();
  sqlite.pragma('foreign_keys = ON');
  return result;
}

function assertMigrated({ error }: MigrationResultSet): void {
  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

async function tableNames(): Promise<string[]> {
  const tables = await db.introspection.getTables();
  return tables.map((table) => table.name).sort();
}

async function columnsByTable(): Promise<Map<string, Set<string>>> {
  const tables = await db.introspection.getTables();
  return new Map(tables.map((table) => [table.name, new Set(table.columns.map((column) => column.name))]));
}

function present(row: Record<string, unknown>, columns: Set<string> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([name]) => columns?.has(name)));
}

interface Seeded {
  categoryId: number;
  feedId: number;
  itemId: number;
}

const ITEM_LINK = 'https://a.example/1';
const READ_AT = '2024-02-01T00:00:00.000Z';

/** Writes one category, one feed and one item, keeping only the columns the current schema version has. */
async function seed(): Promise<Seeded> {
  const columns = await columnsByTable();

  const category = await db.insertInto('feedCategory')
    .values(present({ name: 'tech', workspace_id: HOME_WORKSPACE_ID }, columns.get('feedCategory')))
    .returning('id')
    .executeTakeFirstOrThrow();

  const feed = await db.insertInto('feedMetadata')
    .values(present({
      link: 'https://a.example/feed',
      title: 'Feed A',
      category_id: category.id,
      showInHome: 1,
      icon: 'https://a.example/icon.png',
    }, columns.get('feedMetadata')))
    .returning('id')
    .executeTakeFirstOrThrow();

  if (columns.has('feedPlacement')) {
    await db.insertInto('feedPlacement')
      .values({ feed_id: feed.id, category_id: category.id, workspace_id: HOME_WORKSPACE_ID, showInWorkspace: 1 })
      .execute();
  }

  const item = await db.insertInto('feedItem')
    .values(present({
      feed_id: feed.id,
      title: 'Item 1',
      link: ITEM_LINK,
      guid: ITEM_LINK,
      pubDate: '2024-01-01',
      description: 'Description 1',
      read_at: READ_AT,
    }, columns.get('feedItem')))
    .returning('id')
    .executeTakeFirstOrThrow();

  if (columns.has('articleContent')) {
    await db.insertInto('articleContent')
      .values({ item_id: item.id, html: '<p>Body</p>', text: 'Body', word_count: 1, status: 'ok' })
      .execute();
  }

  return { categoryId: category.id, feedId: feed.id, itemId: item.id };
}

async function brokenForeignKeys(): Promise<readonly unknown[]> {
  const { rows } = await sql`pragma foreign_key_check`.execute(db);
  return rows;
}

describe.each(migrationNames)('a database populated at %s', (name) => {
  test('keeps its rows when migrated to latest', async () => {
    // Arrange
    assertMigrated(await migrateTo(name));
    const seeded = await seed();

    // Act
    assertMigrated(await migrateToLatest());

    // Assert
    const feed = await db.selectFrom('feedMetadata').selectAll().where('id', '=', seeded.feedId).executeTakeFirst();
    expect(feed).toMatchObject({ id: seeded.feedId, title: 'Feed A' });

    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirst();
    expect(item).toMatchObject({ id: seeded.itemId, title: 'Item 1' });

    expect(await brokenForeignKeys()).toEqual([]);
  });
});

describe('migrateToLatest', () => {
  test('applies nothing the second time it runs', async () => {
    // Arrange
    assertMigrated(await migrateToLatest());

    // Act
    const second = await migrateToLatest();

    // Assert
    assertMigrated(second);
    expect(second.results).toEqual([]);
  });

  test('brings back the same tables after every migration is rolled back', async () => {
    // Arrange
    assertMigrated(await migrateToLatest());
    const migrated = await tableNames();

    // Act
    assertMigrated(await migrateTo(NO_MIGRATIONS));
    const rolledBack = await tableNames();
    assertMigrated(await migrateToLatest());

    // Assert
    expect(rolledBack).toEqual([]);
    expect(await tableNames()).toEqual(migrated);
  });
});

describe('the schema', () => {
  test('lets two feeds hold the same link', async () => {
    // Arrange
    assertMigrated(await migrateToLatest());
    await seed();
    const other = await db.insertInto('feedMetadata')
      .values({ link: 'https://b.example/feed', title: 'Feed B' })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Act
    await db.insertInto('feedItem')
      .values({ feed_id: other.id, title: 'Item 1', link: ITEM_LINK, guid: ITEM_LINK, pubDate: '2024-01-01', description: '' })
      .execute();

    // Assert
    const shared = await db.selectFrom('feedItem').selectAll().where('link', '=', ITEM_LINK).execute();
    expect(shared).toHaveLength(2);
  });

  test('calls a feed stored without a source type an rss feed, with no fetch state yet', async () => {
    // Arrange
    assertMigrated(await migrateToLatest());
    const seeded = await seed();

    // Assert
    const feed = await db.selectFrom('feedMetadata').selectAll().where('id', '=', seeded.feedId).executeTakeFirst();
    expect(feed).toMatchObject({ type: 'rss', last_fetched_at: null, last_error: null });

    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirst();
    expect(item).toMatchObject({ author: null, extra: null });
  });
});

describe('0003_river_index backfill', () => {
  test('derives published_at from an RFC-822 pubDate', async () => {
    // Arrange
    assertMigrated(await migrateTo('0002_feed_icon'));
    const seeded = await seed();
    await db.updateTable('feedItem').set({ pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT' }).where('id', '=', seeded.itemId).execute();

    // Act
    assertMigrated(await migrateToLatest());

    // Assert
    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirstOrThrow();
    expect(item['published_at']).toBe(new Date('Mon, 01 Jan 2024 00:00:00 GMT').getTime());
  });

  test('derives published_at from an ISO-8601 pubDate', async () => {
    // Arrange
    assertMigrated(await migrateTo('0002_feed_icon'));
    const seeded = await seed();
    await db.updateTable('feedItem').set({ pubDate: '2024-01-01T00:00:00.000Z' }).where('id', '=', seeded.itemId).execute();

    // Act
    assertMigrated(await migrateToLatest());

    // Assert
    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirstOrThrow();
    expect(item['published_at']).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
  });

  test('falls back to 0 for an unparseable pubDate', async () => {
    // Arrange
    assertMigrated(await migrateTo('0002_feed_icon'));
    const seeded = await seed();
    await db.updateTable('feedItem').set({ pubDate: 'not-a-date' }).where('id', '=', seeded.itemId).execute();

    // Act
    assertMigrated(await migrateToLatest());

    // Assert
    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirstOrThrow();
    expect(item['published_at']).toBe(0);
  });

  test('derives excerpt by stripping the description down to plain text', async () => {
    // Arrange
    assertMigrated(await migrateTo('0002_feed_icon'));
    const seeded = await seed();
    await db.updateTable('feedItem').set({ description: '<p>Hello <b>world</b></p>' }).where('id', '=', seeded.itemId).execute();

    // Act
    assertMigrated(await migrateToLatest());

    // Assert
    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirstOrThrow();
    expect(item['excerpt']).toBe('Hello world');
  });

  test('backfills an empty table without error', async () => {
    // Arrange
    assertMigrated(await migrateTo('0002_feed_icon'));

    // Act, Assert
    assertMigrated(await migrateToLatest());
  });
});

describe('0004_workspaces backfill', () => {
  test('creates one Home workspace and one placement per feed, preserving category, showInWorkspace and item counts', async () => {
    // Arrange
    assertMigrated(await migrateTo('0003_river_index'));
    const categoryA = await db.insertInto('feedCategory').values({ name: 'tech' }).returning('id').executeTakeFirstOrThrow();
    const categoryB = await db.insertInto('feedCategory').values({ name: 'news' }).returning('id').executeTakeFirstOrThrow();
    const feedA = await db.insertInto('feedMetadata')
      .values({ link: 'https://a.example/feed', title: 'Feed A', category_id: categoryA.id, showInHome: 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    const feedB = await db.insertInto('feedMetadata')
      .values({ link: 'https://b.example/feed', title: 'Feed B', category_id: categoryB.id, showInHome: 0 })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db.insertInto('feedItem')
      .values({ feed_id: feedA.id, title: 'Item 1', link: ITEM_LINK, guid: ITEM_LINK, pubDate: '2024-01-01', description: '' })
      .execute();

    // Act
    assertMigrated(await migrateToLatest());

    // Assert
    const workspaces = await db.selectFrom('workspace').selectAll().execute();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({ name: 'Home' });
    const home = await db.selectFrom('workspace').selectAll().where('name', '=', 'Home').executeTakeFirstOrThrow();

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    expect(categories.every((category) => category['workspace_id'] === home['id'])).toBe(true);

    const placements = await db.selectFrom('feedPlacement').selectAll().execute();
    expect(placements).toHaveLength(2);
    expect(placements.every((placement) => placement['workspace_id'] === home['id'])).toBe(true);

    const placementA = placements.find((placement) => placement['feed_id'] === feedA.id);
    const placementB = placements.find((placement) => placement['feed_id'] === feedB.id);
    expect(placementA).toMatchObject({ category_id: categoryA.id, showInWorkspace: 1 });
    expect(placementB).toMatchObject({ category_id: categoryB.id, showInWorkspace: 0 });

    const items = await db.selectFrom('feedItem').selectAll().execute();
    expect(items).toHaveLength(1);
    expect(await brokenForeignKeys()).toEqual([]);
  });
});

describe('the migration list', () => {
  test('has unique names, already in the order Migrator will run them', () => {
    // Assert
    expect(new Set(migrationNames).size).toBe(migrationNames.length);
    expect(migrationNames).toEqual([...migrationNames].sort());
  });
});
