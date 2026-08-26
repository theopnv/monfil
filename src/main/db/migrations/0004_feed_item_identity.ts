// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';

// SQLite cannot drop an inline UNIQUE, so changing feedItem.link means rebuilding the whole table.
// SqliteAdapter reports no transactional DDL, so the migrator gives us a connection with no wrapping
// transaction: the rebuild opens its own. Foreign keys go off outside it, or DROP TABLE feedItem
// cascade-deletes every articleContent row.
async function rebuildFeedItem(db: Kysely<any>, work: (trx: Kysely<any>) => Promise<void>): Promise<void> {
  const [pragma] = (await sql<{ foreign_keys: number }>`pragma foreign_keys`.execute(db)).rows;
  await sql`pragma foreign_keys = off`.execute(db);
  try {
    await db.transaction().execute(async (trx) => {
      // AUTOINCREMENT promises never to reuse an id. The counter behind that promise lives in
      // sqlite_sequence, keyed by table name, and DROP TABLE takes it along, so carry it across by hand.
      const [sequence] = (await sql<{ seq: number }>`select seq from sqlite_sequence where name = 'feedItem'`.execute(trx)).rows;

      await work(trx);

      if (sequence) {
        await sql`delete from sqlite_sequence where name = 'feedItem'`.execute(trx);
        await sql`insert into sqlite_sequence (name, seq) values ('feedItem', ${sequence.seq})`.execute(trx);
      }

      const { rows } = await sql`pragma foreign_key_check`.execute(trx);
      if (rows.length > 0) {
        throw new Error(`Rebuilding feedItem left ${rows.length} broken foreign key reference(s).`);
      }
    });
  } finally {
    await sql.raw(`pragma foreign_keys = ${pragma?.foreign_keys ?? 1}`).execute(db);
  }
}

export async function up(db: Kysely<any>): Promise<void> {
  await rebuildFeedItem(db, async (trx) => {
    await trx.schema
      .createTable('feedItem_new')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id').onDelete('cascade'))
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('link', 'text')
      .addColumn('guid', 'text', (col) => col.notNull())
      .addColumn('pubDate', 'text', (col) => col.notNull())
      .addColumn('description', 'text', (col) => col.notNull())
      .addColumn('image', 'text')
      .addColumn('read_at', 'text')
      .addUniqueConstraint('feedItem_feed_guid_unique', ['feed_id', 'guid'])
      .execute();

    // id is copied verbatim: articleContent.item_id references it, and the reader route is /reader/$itemId.
    // The backfill cannot collide, because link was globally unique and no URL starts with "monfil:".
    await sql`
      insert into feedItem_new (id, feed_id, title, link, guid, pubDate, description, image, read_at)
      select id, feed_id, title, link, coalesce(link, 'monfil:legacy:' || id), pubDate, description, image, read_at
      from feedItem
    `.execute(trx);

    await trx.schema.dropTable('feedItem').execute();
    await trx.schema.alterTable('feedItem_new').renameTo('feedItem').execute();
  });
}

// Fails on data the new constraint allows: two feeds holding the same link.
export async function down(db: Kysely<any>): Promise<void> {
  await rebuildFeedItem(db, async (trx) => {
    await trx.schema
      .createTable('feedItem_old')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id').onDelete('cascade'))
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('link', 'text', (col) => col.unique())
      .addColumn('pubDate', 'text', (col) => col.notNull())
      .addColumn('description', 'text', (col) => col.notNull())
      .addColumn('image', 'text')
      .addColumn('read_at', 'text')
      .execute();

    await sql`
      insert into feedItem_old (id, feed_id, title, link, pubDate, description, image, read_at)
      select id, feed_id, title, link, pubDate, description, image, read_at
      from feedItem
    `.execute(trx);

    await trx.schema.dropTable('feedItem').execute();
    await trx.schema.alterTable('feedItem_old').renameTo('feedItem').execute();
  });
}
