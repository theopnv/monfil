---
title: Repository map
description: Find the process and files that own a change.
sidebar:
  order: 3
---

Monfil has three application code trees and a separate documentation site. Follow the boundary that owns the behavior before editing a call site.

| Area | Owns | Depends on |
| --- | --- | --- |
| `src/main/` | App startup, windows, network, feeds, SQLite, filesystem, IPC handlers | `src/shared/` |
| `src/preload/` | The restricted bridge exposed as `window.electron` | `src/shared/` |
| `src/renderer/` | React routes, reader, state, and UI | `src/shared/` and the preload bridge |
| `src/shared/` | IPC types, data contracts, result and error types | |
| `feedpacks/` | Curated OPML files and their catalog | Checked by `scripts/check-feedpacks.mjs` |
| `doc/` | Astro Starlight site | |

```text
Renderer -> preload bridge -> IPC -> main -> SQLite
                                     |--> feeds and articles
                                     |--> OPML, backups, logs
                                     |--> ...

Shared contracts define the types on both sides of IPC.
```

The main process owns every network, database, and filesystem operation. The renderer asks for work through IPC. The preload script exposes only the methods in `src/shared/channels.ts`.

For main:

- `feed/` for fetch and parsing
- `db/` for queries and migrations
- `opml/` for import and export
- `feedpacks/` for catalog and install
- `logging/` for diagnostics
- `ipc/` for requests from the renderer

For the renderer:

- routes live in `src/renderer/routes/`
- providers and query hooks hold UI state

`forge.config.ts` and the process Vite configs control the build.
