// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Kysely } from 'kysely';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('savedItem')
    .addColumn('workspace_id', 'integer', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
    .addColumn('item_id', 'integer', (column) => column.notNull().references('feedItem.id').onDelete('cascade'))
    .addColumn('saved_at', 'integer', (column) => column.notNull())
    .addPrimaryKeyConstraint('savedItem_pk', ['workspace_id', 'item_id'])
    .execute();
  await db.schema.createIndex('savedItem_order').on('savedItem').columns(['workspace_id', 'saved_at', 'item_id']).execute();
  await db.schema.createIndex('savedItem_item').on('savedItem').column('item_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('savedItem').execute();
}
