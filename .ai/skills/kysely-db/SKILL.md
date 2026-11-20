---
name: kysely-db
description: Kysely and SQLite patterns for Monfil's database layer. Use when changing tables, migrations, queries, inserts, upserts, or transactions under src/main/db/.
---

# Kysely database patterns

Read `doc/src/content/docs/contributor-guide/database.md` for data ownership and migrations. Use this skill for query and write patterns in the current code. For Kysely syntax beyond these patterns, see https://kysely.dev/llms-full.txt.

## Types and criteria

Each table has an interface in `src/main/db/types.ts`. Export an alias from it only when another module reads it, as with `FeedItem`.

The reusable criteria queries in `src/main/db/crud/query.ts` use `applyCriteria`, which filters on equality of each field that the `Partial` row sets, so a new column needs no change there. A query with its own filters can use Kysely's `.where()` directly; existing summary and lookup queries do this. Share a repeated upsert by exporting it from `src/main/db/crud/insert.ts`, as `upsertFeedCategory` and `upsertFeedPlacement` are.

## Upserts and errors

Wrap a query that returns a `Result` in `dbTry` from `src/main/db/db-try.ts`. It waits for the database and turns a thrown error into a `DB_ERROR`. Pass `mapKnown` for an error the caller expects, such as `hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE')`.

Feed identity lives in `feedMetadata`. Category, workspace, and visibility live in `feedPlacement`. The upserts in `src/main/db/crud/insert.ts` show the current conflict keys and columns for each table. In `doUpdateSet`, `eb.ref('excluded.column')` reads the proposed row. List each column that must change on conflict; a column's default applies only to a new row.

Return the `Result` type from `src/shared/result.ts` for expected failures. Some best-effort writes, such as article content storage, log errors and return `void`; follow the contract of the operation you change. A private helper inside a transaction may throw so the transaction rolls back.

## Transactions

Use `db.transaction().execute(...)` when several writes must succeed or fail together. `addFeedToDatabase` writes a category, feed metadata, a placement, and items in one transaction. Use its `trx` executor for every query in that transaction.

## SQLite booleans

SQLite stores boolean values as integers. For example, `feedPlacement.showInWorkspace` stores `0` or `1`. Convert a boolean at the write boundary and treat the selected value as a number.

## Tests

Database unit tests use the real Kysely connection. Call `useTestDatabase()` from `src/main/test/db.ts` at the top of the test file. It opens an in-memory database once per file and, after each test, empties every table except the Home workspace. When you add a table, add its delete to `resetDatabase()` in that file, before the tables it depends on. `makeFeedInput()` and `makeItem()` in `src/main/test/fixtures.ts` build feed and item inputs.
