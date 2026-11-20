// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Partial, so a feed's unread count and a workspace's "any unread" check read only the unread rows.
  await db.schema.createIndex('feedItem_feed_id_unread').on('feedItem').column('feed_id').where(sql.ref('read_at'), 'is', null).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('feedItem_feed_id_unread').execute();
}
