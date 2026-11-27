// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

// Earlier builds stored every fetch failure as 'failed'. Reclassifying them with attempted_at 0 lets each one retry once and settle on its real status.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('articleContent')
    .addColumn('attempted_at', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
  await db.updateTable('articleContent').set({ status: 'fetch_failed' }).where('status', '=', 'failed').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.updateTable('articleContent').set({ status: 'failed' }).where('status', '=', 'fetch_failed').execute();
  await db.schema
    .alterTable('articleContent')
    .dropColumn('attempted_at')
    .execute();
}
