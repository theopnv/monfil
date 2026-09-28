// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

// SQLite has no multi-column ALTER TABLE: one statement per column.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('feedMetadata')
    .addColumn('etag', 'text')
    .execute();
  await db.schema
    .alterTable('feedMetadata')
    .addColumn('last_modified', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('feedMetadata')
    .dropColumn('last_modified')
    .execute();
  await db.schema
    .alterTable('feedMetadata')
    .dropColumn('etag')
    .execute();
}
