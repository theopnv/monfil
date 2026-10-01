---
title: Database
description: SQLite data, migrations, backups, and recovery.
sidebar:
  order: 7
---

The main process stores feeds, items, workspaces, categories, placements, and settings in SQLite. `better-sqlite3` opens the file; Kysely provides typed queries. The table types live in `src/main/db/types.ts`, and queries live under `src/main/db/`.

## Data ownership

A feed has one metadata row for its URL. A placement connects that feed to a workspace and category. This lets the same source appear in more than one workspace while sharing its items and read state. A workspace has its own river view.

Main-process settings, such as refresh frequency and item retention, live in SQLite. Renderer-only preferences, such as theme and reading layout, use local storage. Put a new setting where its reader runs; avoid a new IPC call for state that stays in the renderer.

## Startup and migrations

`initializeDatabase()` opens the database and runs pending migrations. Code that reads it awaits `dbReady`. Add a numbered migration under `src/main/db/migrations/` and register it in `index.ts`. The static migration list works inside the bundled main process. Keep the types in `types.ts` aligned with the schema. `src/main/db/crud/query.ts` uses column handlers that make missing query criteria a type error when a table changes.

Before each pending migration of an existing database, Monfil makes a consistent copy. It keeps the two newest migration copies. The migration tests run the current migrations against databases starting at earlier versions; update their seed data when a new column needs it.

## Backups and recovery

Settings offers a manual database backup. OPML export saves feed lists and folders; it does not save articles, read state, or settings. `src/main/db/recovery.ts` moves a corrupt database aside and starts with a fresh one. Other I/O failures go through the error path. `app:get-startup-health` tells the renderer whether startup was normal, reset the database, or failed. The database connection is closed on quit after a WAL checkpoint.
