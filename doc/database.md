# Database

`better-sqlite3` is the driver. [Kysely](https://kysely.dev) supplies the types and the query builder.

## Files

## Await `dbReady` first

`src/main/database.ts` exports `dbReady`, a promise that resolves once the migrator has brought the schema up to date.
Any code path that touches the database must await it. `run()` does this once at startup, and the unit tests do it in `beforeAll`.

The database is file-backed. `src/main/main.ts` is the only place that resolves the file path — `app.getPath('userData')` joined with `DB_FILE_NAME` — and passes it to `initializeDatabase(filePath)`, which assigns `db` and populates `dbReady`. `database.ts` itself stays decoupled from Electron: it takes the path as a parameter instead of resolving it, since the module is also imported directly by unit tests running in plain Node, where importing `app` from `'electron'` would not resolve to a real Electron runtime.

Every connection gets two pragmas: `foreign_keys = ON` (SQLite does not enforce the `.references(...)` foreign keys declared in the migrations unless this is set per connection), and, for file-backed connections only, `journal_mode = WAL`.

Migrations are supplied by a hand-written `MigrationProvider` in `src/main/db/migrations/index.ts`, backed by a statically-imported `Record<string, Migration>`, not Kysely's built-in `FileMigrationProvider`. `FileMigrationProvider` scans a folder with `fs.readdir()` and dynamically `import()`s each file, which assumes loose files on disk — untrue once Vite bundles the main process into `.vite/build/main.js`. Add a migration by creating `000X_description.ts` next to `index.ts` and adding one line to the `migrations` record; `Migrator` sorts by name, so the numeric prefix keeps ordering explicit.

Migration `0002_feed_item_read` adds `feedItem.read_at`, a nullable text column holding an ISO timestamp, or nothing when the item is unread. It is the one column in the schema an update can explicitly clear back to `NULL`, so `FeedItemTable` types it with `ColumnType<string | undefined, string | undefined, string | null>` rather than the plain `string | undefined` used for `link` and `image`: select and insert stay `string | undefined` (the existing nullable-column convention), while update additionally allows `null`. `setFeedItemsRead` (`src/main/db/update.ts`) is the only writer.

Call `closeDatabase()` before the process exits so `better-sqlite3` closes its connection cleanly. `src/main/main.ts` already does this in its `before-quit` handler.

`initializeDatabase` runs its open-and-migrate step through `withCorruptionRecovery` (`src/main/db/recovery.ts`). If the process was killed rather than closed cleanly, the WAL sidecar files (`-wal`, `-shm`) can outlive a database file that was deleted or replaced by hand, which SQLite reports as a disk I/O error rather than "file not found". `withCorruptionRecovery` recognizes that error shape, deletes the stale files, and retries once. This only applies to file-backed databases; `:memory:` connections used by tests skip it.

## Query criteria must stay exhaustive

`src/main/db/query.ts` builds each query through a `CriteriaHandlers` mapped type. The type requires one handler per column of the table.

This is deliberate. Add a column to a table interface without adding its handler, and the build fails. It stops a new column from being silently unfilterable. Keep the mapped type when you add a table.

## Native module packaging

`better-sqlite3` is listed as `external` in `vite.main.config.mts`. It resolves its `.node` binary against its own package directory, so bundling it breaks the load. Any other native dependency in the main process needs the same treatment.

## Tests

Unit tests import the same `db` singleton that the app uses. There is no fixture database. Call `initializeDatabase(':memory:')` in `beforeAll` to migrate a fresh in-memory database before using `db`. Delete the rows in `afterEach` so each test starts clean, and delete children before parents to respect the foreign keys.
