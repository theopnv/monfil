# Database

`better-sqlite3` is the driver. [Kysely](https://kysely.dev) supplies the types and the query builder.

## Files

| File | Holds |
| --- | --- |
| `src/main/types.ts` | The `Database` interface and one table interface per table. |
| `src/main/database.ts` | The `db` singleton, the schema, and `dbReady`. |
| `src/main/db/insert.ts` | Writes. |
| `src/main/db/query.ts` | Reads. |

Table interfaces use Kysely's `Generated`, and each one exports the `Selectable`/`Insertable`/`Updateable` aliases. Use those aliases in call signatures instead of the raw table interface.

## Await `dbReady` first

`src/main/database.ts` exports `dbReady`, a promise that resolves when the schema exists.
Any code path that touches the database must await it. `run()` does this once at startup, and the unit tests do it in `beforeAll`.

The database is in memory, so it is rebuilt on every process start and the schema is created inline. If the database moves to disk, replace that inline creation with a versioned migrator and keep `dbReady` as the same public contract.

## Query criteria must stay exhaustive

`src/main/db/query.ts` builds each query through a `CriteriaHandlers` mapped type. The type requires one handler per column of the table.

This is deliberate. Add a column to a table interface without adding its handler, and the build fails. It stops a new column from being silently unfilterable. Keep the mapped type when you add a table.

## Native module packaging

`better-sqlite3` is listed as `external` in `vite.main.config.mts`. It resolves its `.node` binary against its own package directory, so bundling it breaks the load. Any other native dependency in the main process needs the same treatment.

## Tests

Unit tests import the same `db` singleton that the app uses. There is no fixture database. Delete the rows in `afterEach` so each test starts clean, and delete children before parents to respect the foreign keys.
