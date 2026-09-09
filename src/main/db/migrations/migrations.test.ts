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
import { rmTestDir } from '../../lib/rmTestDir';

// A real file rather than ':memory:', so the table rebuilds run the way they will run on a user's install.
let dir: string;
let db: Kysely<any>;
let migrator: Migrator;

const migrationNames = Object.keys(await migrationProvider.getMigrations());

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'monfil-db-'));
  const sqlite = new SQLite(path.join(dir, 'monfil.db'));
  sqlite.pragma('foreign_keys = ON');
  db = new Kysely<any>({ dialect: new SqliteDialect({ database: sqlite }) });
  migrator = new Migrator({ db, provider: migrationProvider });
});

afterEach(async () => {
  await db.destroy();
  await rmTestDir(dir);
});

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
    .values(present({ name: 'tech' }, columns.get('feedCategory')))
    .returning('id')
    .executeTakeFirstOrThrow();

  const feed = await db.insertInto('feedMetadata')
    .values(present({
      link: 'https://a.example/feed',
      title: 'Feed A',
      category_id: category.id,
      showInHome: 1,
    }, columns.get('feedMetadata')))
    .returning('id')
    .executeTakeFirstOrThrow();

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
    assertMigrated(await migrator.migrateTo(name));
    const seeded = await seed();

    // Act
    assertMigrated(await migrator.migrateToLatest());

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
    assertMigrated(await migrator.migrateToLatest());

    // Act
    const second = await migrator.migrateToLatest();

    // Assert
    assertMigrated(second);
    expect(second.results).toEqual([]);
  });

  test('brings back the same tables after every migration is rolled back', async () => {
    // Arrange
    assertMigrated(await migrator.migrateToLatest());
    const migrated = await tableNames();

    // Act
    assertMigrated(await migrator.migrateTo(NO_MIGRATIONS));
    const rolledBack = await tableNames();
    assertMigrated(await migrator.migrateToLatest());

    // Assert
    expect(rolledBack).toEqual([]);
    expect(await tableNames()).toEqual(migrated);
  });
});

describe('0004_feed_item_identity', () => {
  const BEFORE = '0003_article_content';

  test('keeps item ids, read marks and article content across the table rebuild', async () => {
    // Arrange
    assertMigrated(await migrator.migrateTo(BEFORE));
    const seeded = await seed();

    // Act
    assertMigrated(await migrator.migrateToLatest());

    // Assert
    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirst();
    expect(item).toMatchObject({ id: seeded.itemId, link: ITEM_LINK, read_at: READ_AT });

    const joined = await db.selectFrom('articleContent')
      .innerJoin('feedItem', 'feedItem.id', 'articleContent.item_id')
      .select(['articleContent.text', 'feedItem.title'])
      .execute();
    expect(joined).toEqual([{ text: 'Body', title: 'Item 1' }]);
  });

  test('backfills guid from link, and synthesises one for a linkless item', async () => {
    // Arrange
    assertMigrated(await migrator.migrateTo(BEFORE));
    const seeded = await seed();
    const linkless = await db.insertInto('feedItem')
      .values({ feed_id: seeded.feedId, title: 'Linkless', link: null, pubDate: '2024-01-02', description: '' })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Act
    assertMigrated(await migrator.migrateToLatest());

    // Assert
    const items = await db.selectFrom('feedItem').select(['id', 'guid']).orderBy('id').execute();
    expect(items).toEqual([
      { id: seeded.itemId, guid: ITEM_LINK },
      { id: linkless.id, guid: `monfil:legacy:${linkless.id}` },
    ]);
  });

  test('keeps handing out ids above the highest one the old table used', async () => {
    // Arrange
    assertMigrated(await migrator.migrateTo(BEFORE));
    const seeded = await seed();
    await db.deleteFrom('articleContent').execute();
    await db.deleteFrom('feedItem').execute();

    // Act
    assertMigrated(await migrator.migrateToLatest());
    const fresh = await db.insertInto('feedItem')
      .values({ feed_id: seeded.feedId, title: 'After', link: null, guid: 'g', pubDate: '2024-01-03', description: '' })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Assert
    expect(fresh.id).toBeGreaterThan(seeded.itemId);
  });

  test('lets two feeds hold the same link once applied', async () => {
    // Arrange
    assertMigrated(await migrator.migrateToLatest());
    const seeded = await seed();
    const other = await db.insertInto('feedMetadata')
      .values({ link: 'https://b.example/feed', title: 'Feed B', category_id: seeded.categoryId, showInHome: 1 })
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
});

describe('0005_feed_source_type', () => {
  test('calls a feed stored before there were source types an rss feed, with no fetch state yet', async () => {
    // Arrange
    assertMigrated(await migrator.migrateTo('0004_feed_item_identity'));
    const seeded = await seed();

    // Act
    assertMigrated(await migrator.migrateToLatest());

    // Assert
    const feed = await db.selectFrom('feedMetadata').selectAll().where('id', '=', seeded.feedId).executeTakeFirst();
    expect(feed).toMatchObject({ type: 'rss', last_fetched_at: null, last_error: null });

    const item = await db.selectFrom('feedItem').selectAll().where('id', '=', seeded.itemId).executeTakeFirst();
    expect(item).toMatchObject({ author: null, extra: null });
  });
});

describe('the migration list', () => {
  test('has unique names, already in the order Migrator will run them', () => {
    // Assert
    expect(new Set(migrationNames).size).toBe(migrationNames.length);
    expect(migrationNames).toEqual([...migrationNames].sort());
  });
});
