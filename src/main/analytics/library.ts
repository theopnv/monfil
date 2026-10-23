// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { db, dbReady } from '../db/database';

export interface LibraryState {
  feeds: number;
  workspaces: number;
  categories: number;
  feedKinds: string[];
}

/** Reads the library numbers that go into the summary. */
export async function readLibraryState(): Promise<LibraryState> {
  await dbReady;
  const [feeds, workspaces, categories, kinds] = await Promise.all([
    db.selectFrom('feedMetadata').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
    db.selectFrom('workspace').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
    db.selectFrom('feedCategory').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
    db.selectFrom('feedMetadata').select('type').distinct().orderBy('type').execute(),
  ]);
  return { feeds: feeds.count, workspaces: workspaces.count, categories: categories.count, feedKinds: kinds.map((row) => row.type) };
}

/** Counts the feeds in the library. */
export async function countFeeds(): Promise<number> {
  await dbReady;
  const { count } = await db.selectFrom('feedMetadata').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
  return count;
}
