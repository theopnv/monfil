---
name: kysely-db
description: Kysely and SQLite patterns for Monfil's database layer. Use when changing tables, migrations, queries, inserts, upserts, or transactions under src/main/db/.
---

# Kysely database patterns

Read `doc/src/content/docs/contributor-guide/database.md` for data ownership and migrations. Use this skill for query and write patterns in the current code. For Kysely syntax beyond these patterns, see https://kysely.dev/llms-full.txt.

## Types and criteria

Each table has an interface in `src/main/db/types.ts`. Use its `Selectable`, `Insertable`, or `Updateable` alias when that operation needs one. `Generated<T>` makes a database-assigned value present on reads and optional on inserts. Some tables have no update alias because the code does not update them.

The reusable criteria queries in `src/main/db/crud/query.ts` use `CriteriaHandlers` and `applyCriteria`. When you add a column to a table covered by those handlers, add its handler too. A query with its own filters can use Kysely's `.where()` directly; existing summary and lookup queries do this.

## Upserts and errors

Feed identity lives in `feedMetadata`. Category, workspace, and visibility live in `feedPlacement`. The upserts in `src/main/db/crud/insert.ts` show the current conflict keys and columns for each table. In `doUpdateSet`, `eb.ref('excluded.column')` reads the proposed row. List each column that must change on conflict; a column's default applies only to a new row.

Use `.returningAll()` when the caller needs the stored row. Choose `executeTakeFirstOrThrow()` when a missing row is an error, `executeTakeFirst()` when it is a valid outcome, and `execute()` for a set of rows.

Queries can throw on database errors, including calls to `execute()`. Catch errors at the operation boundary. Return the `Result` type from `src/shared/result.ts` for expected failures. Some best-effort writes, such as article content storage, log errors and return `void`; follow the contract of the operation you change. A private helper inside a transaction may throw so the transaction rolls back.

## Transactions

Use `db.transaction().execute(...)` when several writes must succeed or fail together. `addFeedToDatabase` writes a category, feed metadata, a placement, and items in one transaction. Use its `trx` executor for every query in that transaction.

## SQLite booleans

SQLite stores boolean values as integers. For example, `feedPlacement.showInWorkspace` stores `0` or `1`. Convert a boolean at the write boundary and treat the selected value as a number.

## Tests

Database unit tests use the real Kysely connection. Initialize an in-memory database in `beforeAll` with `initializeDatabase(':memory:')`. In `afterEach`, delete dependent rows before their parents. The current insert and query tests remove article content and items, then placements, metadata, categories, and non-Home workspaces. Check those tests before adding a new table to setup or cleanup.
