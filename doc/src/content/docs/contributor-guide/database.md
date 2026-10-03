---
title: Database
description: SQLite data, migrations, backups, and recovery.
sidebar:
  order: 7
---

The main process stores feeds, items, workspaces, categories, placements, and settings in SQLite. `better-sqlite3` opens the database; Kysely provides typed queries. Explore the [database code](https://github.com/theopnv/monfil/tree/main/src/main/db) when you change stored data.

## Choose where state lives

Store refresh frequency and item retention in SQLite. They affect work that runs in the main process. Keep UI preferences, such as theme and reading layout, in the renderer's local storage.

A feed has one metadata row for its URL. A placement connects it to a workspace and category, so several workspaces can show the same feed while sharing its items and read state.

## Change the schema

Add a numbered migration in the [migrations folder](https://github.com/theopnv/monfil/tree/main/src/main/db/migrations), then register it in the [migration list](https://github.com/theopnv/monfil/blob/main/src/main/db/migrations/index.ts). Update the [table types](https://github.com/theopnv/monfil/blob/main/src/main/db/types.ts) to match. The static list lets migrations run in the bundled app.

At startup, `initializeDatabase()` runs pending migrations. Code that reads the database awaits `dbReady`. For an existing database, Monfil makes a consistent copy before each pending migration and keeps the two newest copies.

:::tip[Check old databases]
Migration tests start from earlier schema versions. Update their seed data when a new column requires it, then run the affected tests.
:::

## Back up and recover

Settings offers a manual database backup. OPML export saves feed lists and folders. It leaves out articles, read state, and settings, so use a database backup when you need those.

If SQLite data is corrupt, the [recovery code](https://github.com/theopnv/monfil/blob/main/src/main/db/recovery.ts) moves it aside and starts a fresh database. Other I/O failures follow the error path. The `app:get-startup-health` channel tells the renderer whether startup succeeded, reset the database, or failed. On quit, Monfil checkpoints the WAL and closes the connection.
