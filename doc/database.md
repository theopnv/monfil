# Database

Dependencies:
- [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) is the driver.
- [Kysely](https://kysely.dev) supplies the types and the query builder.

## Readying the database

The database is file-backed, resolved in `src/main/db/database.ts`.

It exports `dbReady`, a promise that resolves once the migrator has brought the schema up to date.
Any code path that touches the database must await it. `run()` does this once at startup, and the unit tests do it in `beforeAll`.

There is a "recovery" mechanism in `src/main/db/recovery.ts`. If it detects corrupted files or leftovers, it will delete them and restart from a clean slate.

Call `closeDatabase()` before the process exits so `better-sqlite3` closes its connection cleanly. `src/main/main.ts` already does this in its `before-quit` handler.

## Query

`src/main/db/query.ts` builds each query through a `CriteriaHandlers` mapped type. The type requires one handler per column of the table.
This is deliberate, to avoid adding a column to a table interface without adding its handler (compilation failure).

## Migrations

Migrations are supplied by a hand-written `MigrationProvider` in `src/main/db/migrations/index.ts`, backed by a statically-imported `Record<string, Migration>`, not Kysely's built-in `FileMigrationProvider`. `FileMigrationProvider` scans a folder with `fs.readdir()` and dynamically `import()`s each file, which assumes loose files on disk — untrue once Vite bundles the main process into `.vite/build/main.js`.

Add a migration by creating `000X_description.ts` next to `index.ts` and adding one line to the `migrations` record. `Migrator` sorts by name, so the numeric prefix keeps ordering explicit.

## Tests

Unit tests import the same `db` singleton that the app uses. There is no fixture database. Call `initializeDatabase(':memory:')` in `beforeAll` to migrate a fresh in-memory database before using `db`. Delete the rows in `afterEach` so each test starts clean, and delete children before parents to respect the foreign keys.

`src/main/db/migrations/migrations.test.ts` runs every migration against a populated file, once per starting version. Adding a migration adds a case to that loop for free. Adding a *column* usually means updating the seed row in the same file, so the fixture keeps covering it.
