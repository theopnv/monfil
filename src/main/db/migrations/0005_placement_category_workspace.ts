// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // A placement could point at a category owned by another workspace, which put a feed in a folder
  // its own sidebar never lists and left the other workspace undeletable. Repair those rows first:
  // the composite foreign key added below refuses them, and `foreign_key_check` runs after every
  // migration.
  const mismatched = await db.selectFrom('feedPlacement as p')
    .innerJoin('feedCategory as c', 'c.id', 'p.category_id')
    .whereRef('c.workspace_id', '!=', 'p.workspace_id')
    .select(['p.feed_id as feed_id', 'p.workspace_id as workspace_id', 'c.name as name'])
    .execute();

  for (const placement of mismatched) {
    const category = await db.insertInto('feedCategory')
      .values({ name: placement.name, workspace_id: placement.workspace_id })
      .onConflict((oc: any) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb: any) => ({ name: eb.ref('excluded.name') })))
      .returning('id')
      .executeTakeFirstOrThrow();

    await db.updateTable('feedPlacement')
      .set({ category_id: category.id })
      .where('feed_id', '=', placement.feed_id)
      .where('workspace_id', '=', placement.workspace_id)
      .execute();
  }

  // SQLite only accepts a parent key that carries a UNIQUE index, so the composite foreign key below
  // needs this even though `id` is already the primary key on its own.
  await db.schema
    .createIndex('feedCategory_id_workspace_unique')
    .on('feedCategory')
    .columns(['id', 'workspace_id'])
    .unique()
    .execute();

  // feedPlacement: `category_id` alone let a placement reference any workspace's category. The pair
  // (category_id, workspace_id) has to resolve to one feedCategory row instead. A constraint cannot
  // be added by an in-place ALTER, so rebuild the table.
  await db.schema
    .createTable('feedPlacement_new')
    .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id').onDelete('cascade'))
    .addColumn('category_id', 'integer', (col) => col.notNull())
    .addColumn('workspace_id', 'integer', (col) => col.notNull().references('workspace.id').onDelete('cascade'))
    .addColumn('showInWorkspace', 'integer', (col) => col.notNull().defaultTo(1))
    .addPrimaryKeyConstraint('feedPlacement_pk', ['feed_id', 'workspace_id'])
    .addForeignKeyConstraint(
      'feedPlacement_category_workspace_fk',
      ['category_id', 'workspace_id'],
      'feedCategory',
      ['id', 'workspace_id'],
    )
    .execute();

  await db.insertInto('feedPlacement_new')
    .columns(['feed_id', 'category_id', 'workspace_id', 'showInWorkspace'])
    .expression((eb: any) => eb.selectFrom('feedPlacement')
      .select(['feed_id', 'category_id', 'workspace_id', 'showInWorkspace']))
    .execute();

  await db.schema.dropTable('feedPlacement').execute();
  await db.schema.alterTable('feedPlacement_new').renameTo('feedPlacement').execute();

  await db.schema.createIndex('feedPlacement_workspace_id').on('feedPlacement').column('workspace_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('feedPlacement_old')
    .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id').onDelete('cascade'))
    .addColumn('category_id', 'integer', (col) => col.notNull().references('feedCategory.id'))
    .addColumn('workspace_id', 'integer', (col) => col.notNull().references('workspace.id').onDelete('cascade'))
    .addColumn('showInWorkspace', 'integer', (col) => col.notNull().defaultTo(1))
    .addPrimaryKeyConstraint('feedPlacement_pk', ['feed_id', 'workspace_id'])
    .execute();

  await db.insertInto('feedPlacement_old')
    .columns(['feed_id', 'category_id', 'workspace_id', 'showInWorkspace'])
    .expression((eb: any) => eb.selectFrom('feedPlacement')
      .select(['feed_id', 'category_id', 'workspace_id', 'showInWorkspace']))
    .execute();

  await db.schema.dropTable('feedPlacement').execute();
  await db.schema.alterTable('feedPlacement_old').renameTo('feedPlacement').execute();

  await db.schema.createIndex('feedPlacement_workspace_id').on('feedPlacement').column('workspace_id').execute();

  await db.schema.dropIndex('feedCategory_id_workspace_unique').execute();
}
