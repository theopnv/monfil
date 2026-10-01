---
title: Feedpacks and OPML
description: Curated feed lists, import, install, and export.
sidebar:
  order: 9
---

A feedpack is an OPML file in `feedpacks/` with catalog metadata in `feedpacks/index.json`. Contributors who want to submit a pack can follow the [feedpack submission guide](../../user-guide/submit-a-feedpack/). `npm run check:feedpacks` checks the catalog and its OPML files.

The feedpack browser asks main for the catalog and a preview. `src/main/feedpacks/catalog.ts` fetches the catalog when needed, uses a disk cache, and can fall back to the bundled copy. `src/main/feedpacks/install.ts` loads the selected OPML, then passes it to the import path. This keeps pack install and file import on the same rules for categories, feeds, and placements.

`src/main/opml/parse.ts` reads the file. `import.ts` adds its feeds to a new or existing workspace, then refreshes them. The database has one feed row per URL, so importing a source that already exists can add a placement without making another copy of its articles. `export.ts` writes one workspace as OPML. An export carries its feed list and folders; use a database backup to preserve read state and articles.

A pack install can create a workspace or merge into one. Once installed, its sources belong to that workspace and can be edited there. The catalog is separate from the user's database.
