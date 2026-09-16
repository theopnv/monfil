// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

// Home is the workspace nobody installs and nobody deletes. Its icon and colour match the rail's
// existing Home nav button (Toolbar.tsx) and the brand-500 swatch, so a freshly migrated tab looks
// like it was always there.
const HOME_NAME = 'Home';
const HOME_ICON = 'Home02';
const HOME_COLOR = '#d67f48';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workspace')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('icon', 'text', (col) => col.notNull())
    .addColumn('color', 'text', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('source_slug', 'text')
    .addColumn('source_version', 'text')
    .addColumn('installed_at', 'text')
    .execute();

  const home = await db.insertInto('workspace')
    .values({ name: HOME_NAME, icon: HOME_ICON, color: HOME_COLOR, position: 0 })
    .returning('id')
    .executeTakeFirstOrThrow();

  // feedCategory: the unique constraint moves from `name` to `(workspace_id, name)`. That constraint
  // lives in an implicit sqlite_autoindex, so it cannot be changed by an in-place ALTER; rebuild the
  // table instead.
  await db.schema
    .createTable('feedCategory_new')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('workspace_id', 'integer', (col) => col.notNull().references('workspace.id'))
    .addUniqueConstraint('feedCategory_workspace_name_unique', ['workspace_id', 'name'])
    .execute();

  await db.insertInto('feedCategory_new')
    .columns(['id', 'name', 'workspace_id'])
    .expression((eb: any) => eb.selectFrom('feedCategory')
      .select(['id', 'name', eb.val(home.id).as('workspace_id')]))
    .execute();

  await db.schema.dropTable('feedCategory').execute();
  await db.schema.alterTable('feedCategory_new').renameTo('feedCategory').execute();

  // feedPlacement: where a feed appears. Built from the old feedMetadata's category_id/showInHome
  // before that table is rebuilt below, since those columns are about to leave it.
  await db.schema
    .createTable('feedPlacement')
    .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id').onDelete('cascade'))
    .addColumn('category_id', 'integer', (col) => col.notNull().references('feedCategory.id'))
    .addColumn('workspace_id', 'integer', (col) => col.notNull().references('workspace.id').onDelete('cascade'))
    .addColumn('showInWorkspace', 'integer', (col) => col.notNull().defaultTo(1))
    .addPrimaryKeyConstraint('feedPlacement_pk', ['feed_id', 'workspace_id'])
    .execute();

  await db.schema.createIndex('feedPlacement_workspace_id').on('feedPlacement').column('workspace_id').execute();

  await db.insertInto('feedPlacement')
    .columns(['feed_id', 'category_id', 'workspace_id', 'showInWorkspace'])
    .expression((eb: any) => eb.selectFrom('feedMetadata')
      .select(['id', 'category_id', eb.val(home.id).as('workspace_id'), 'showInHome']))
    .execute();

  // feedMetadata: identity only. `category_id` and `showInHome` are placement, not identity, and
  // move to feedPlacement above. `DROP COLUMN` is refused for `category_id` because it carries a
  // `REFERENCES` constraint, so the table is rebuilt rather than altered in place.
  await db.schema
    .createTable('feedMetadata_new')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('link', 'text', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull().defaultTo('rss'))
    .addColumn('last_fetched_at', 'text')
    .addColumn('last_error', 'text')
    .addColumn('icon', 'text')
    .execute();

  await db.insertInto('feedMetadata_new')
    .columns(['id', 'link', 'title', 'type', 'last_fetched_at', 'last_error', 'icon'])
    .expression((eb: any) => eb.selectFrom('feedMetadata')
      .select(['id', 'link', 'title', 'type', 'last_fetched_at', 'last_error', 'icon']))
    .execute();

  await db.schema.dropTable('feedMetadata').execute();
  await db.schema.alterTable('feedMetadata_new').renameTo('feedMetadata').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const home = await db.selectFrom('workspace').selectAll().where('name', '=', HOME_NAME).executeTakeFirstOrThrow();

  await db.schema
    .createTable('feedMetadata_old')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('link', 'text', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('category_id', 'integer', (col) => col.notNull().references('feedCategory.id'))
    .addColumn('showInHome', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('type', 'text', (col) => col.notNull().defaultTo('rss'))
    .addColumn('last_fetched_at', 'text')
    .addColumn('last_error', 'text')
    .addColumn('icon', 'text')
    .execute();

  await db.insertInto('feedMetadata_old')
    .columns(['id', 'link', 'title', 'category_id', 'showInHome', 'type', 'last_fetched_at', 'last_error', 'icon'])
    .expression((eb: any) => eb.selectFrom('feedMetadata as f')
      .innerJoin('feedPlacement as p', 'p.feed_id', 'f.id')
      .where('p.workspace_id', '=', home['id'])
      .select(['f.id', 'f.link', 'f.title', 'p.category_id', 'p.showInWorkspace', 'f.type', 'f.last_fetched_at', 'f.last_error', 'f.icon']))
    .execute();

  await db.schema.dropTable('feedMetadata').execute();
  await db.schema.alterTable('feedMetadata_old').renameTo('feedMetadata').execute();

  await db.schema.dropTable('feedPlacement').execute();

  await db.schema
    .createTable('feedCategory_old')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .execute();

  await db.insertInto('feedCategory_old')
    .columns(['id', 'name'])
    .expression((eb: any) => eb.selectFrom('feedCategory').select(['id', 'name']))
    .execute();

  await db.schema.dropTable('feedCategory').execute();
  await db.schema.alterTable('feedCategory_old').renameTo('feedCategory').execute();

  await db.schema.dropTable('workspace').execute();
}
