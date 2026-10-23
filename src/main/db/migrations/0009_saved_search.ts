// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Kysely } from 'kysely';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('savedSearch')
    .addColumn('id', 'integer', (column) => column.primaryKey().autoIncrement())
    .addColumn('workspace_id', 'integer', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('query', 'text', (column) => column.notNull())
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('created_at', 'integer', (column) => column.notNull())
    .execute();
  await db.schema.createIndex('savedSearch_workspace_name').on('savedSearch').columns(['workspace_id', 'name']).unique().execute();
  await db.schema.alterTable('workspace').addColumn('search_hint_dismissed_at', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workspace').dropColumn('search_hint_dismissed_at').execute();
  await db.schema.dropTable('savedSearch').execute();
}
