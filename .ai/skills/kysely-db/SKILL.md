---
name: kysely-db
description: Kysely query-builder patterns and conventions for monfil's database layer (better-sqlite3 driver). Use this whenever touching src/main/db/**/*.ts or src/main/db/types.ts — adding a table or column, writing an insert/upsert, writing a select query, wrapping multiple writes together, or fixing a Kysely type error. Also use it for phrases like "add a column", "add a table", "query the database", "upsert this feed", "insert into the db", even if the user doesn't say "Kysely" by name.
---

# Kysely database patterns

This project's database architecture (file layout, `dbReady`, the `CriteriaHandlers` exhaustiveness trick, native module packaging) is documented in `doc/database.md` — read that first for the "where does this go" question. This skill covers the "how do I write this query correctly" question: the Kysely syntax this codebase relies on, and the mistakes that are easy to make with it.

For anything not covered below, the full Kysely docs are at https://kysely.dev/llms-full.txt.

## Types: Selectable / Insertable / Updateable

Every table gets one interface in `src/main/db/types.ts`, plus three derived aliases.
Use the aliases in function signatures — never the raw table interface — because the raw interface's `Generated<T>` columns are wrong for both directions (optional on read, present on write):

```ts
export interface FeedItemTable {
  id: Generated<number>;
  feed_id: number;
  title: string;
  link: string | undefined;
  pubDate: string;
  description: string;
}

export type FeedItem = Selectable<FeedItemTable>;       // reads: id is number
export type NewFeedItem = Insertable<FeedItemTable>;    // writes: id is optional
export type UpdateFeedItem = Updateable<FeedItemTable>; // patches: every field optional
```

Adding a column means adding it to the table interface, then following the compiler: `CriteriaHandlers` in `query.ts` requires a handler per field, so a missed one is a build error, not a silent gap.

## Reading: `selectFrom` through `CriteriaHandlers`

Don't hand-write `.where()` chains for new queries — extend the relevant `CriteriaHandlers` object in `src/main/db/crud/query.ts` and call `applyCriteria`. See that file for the existing pattern before adding a new query function next to it.

## Writing: upsert with `onConflict`

The insert helpers in `src/main/db/crud/insert.ts` follow one shape — reuse it rather than inventing a new one:

```ts
await db.insertInto('feedMetadata')
  .values({ link, title, category_id: categoryId, showInHome: showInHome ? 1 : 0 })
  .onConflict((oc) => oc.column('link').doUpdateSet((eb) => ({
    title: eb.ref('excluded.title'),
    category_id: eb.ref('excluded.category_id'),
    showInHome: eb.ref('excluded.showInHome'),
  })))
  .returningAll()
  .executeTakeFirstOrThrow();
```

Points that are easy to get wrong here:

- `eb.ref('excluded.<column>')` is how you refer to the row that conflicted, in `doUpdateSet`. It is a plain string ref, not a function call — this is the better-sqlite3 dialect's shape, not the Postgres `excluded()` helper you'll see in generic Kysely examples.
- `doUpdateSet` only sets the columns you list. If a new column needs to survive an upsert (like `showInHome` did until it was added here), it must be listed explicitly — the SQLite default only applies on first insert, not on the conflict path.
- Pick the execute method by what "no row" means: `executeTakeFirstOrThrow()` when a missing row is a bug; `executeTakeFirst()` when a missing row is a valid outcome; `execute()` for anything that returns a set.
- `.returningAll()` gets you the row back (including the DB-assigned `id`) without a second query.
- `try/catch` isn't only for `executeTakeFirstOrThrow()`'s built-in "no row" throw. Any query, including a plain `execute()`, can throw on a real DB error (disk I/O, a constraint SQLite didn't handle for you). Every exported write function must catch and map to the `Result` type from `src/utils.ts` — see `addFeedItemsToDatabase` in `src/main/db/crud/insert.ts`, which used to let `execute()` throw straight to its caller.
- A private helper called only from inside a transaction (like `addFeedCategoryToDatabase` in `insert.ts`) can keep throwing instead of returning `Result`. The exported function wrapping the transaction already catches and maps to `Result` at its own boundary, so the helper's throw is what aborts the transaction — turning it into a `Result` would just force the caller to check it and throw anyway to get the same rollback.

## Multi-step writes: wrap them in a transaction

A function that does several `db.insertInto(...)` calls in sequence (category, then metadata, then items — see `addFeedToDatabase`) can fail partway through and leave the earlier inserts committed. If a new write path does more than one insert and they should succeed or fail together, wrap them in `db.transaction()` instead of awaiting each one on `db` directly:

```ts
await db.transaction().execute(async (trx) => {
  const category = await trx.insertInto('feedCategory')...;
  const metadata = await trx.insertInto('feedMetadata')...;
  await trx.insertInto('feedItem')...;
});
```

Once inside `.execute(async (trx) => ...)`, use `trx` for every query in that block — mixing `trx` and `db` defeats the transaction, since `db` queries commit outside it.

## SQLite has no boolean type

`showInHome` is declared `integer` and stored as `0`/`1`. When a field is conceptually a boolean, convert at the write boundary (`showInHome ? 1 : 0`) and treat it as `number` on the read side — don't add a boolean column type, better-sqlite3 doesn't have one.

## Tests

Unit tests hit the real `db` singleton after `await dbReady` in `beforeAll` — there's no mock database. Clean up in `afterEach`, deleting children before parents so foreign keys don't block the delete:

```ts
afterEach(async () => {
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});
```

Look at `src/main/db/crud/insert.test.ts` or `src/main/db/crud/query.test.ts` for the current shape before writing a new test file.
