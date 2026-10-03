---
title: Repository map
description: Find the process and folders that own a change.
sidebar:
  order: 3
---

Monfil has three application process trees and a separate documentation site. Find the boundary that owns a behavior before you edit its caller.

## Follow the process boundary

```text
Renderer -> preload bridge -> IPC -> main -> SQLite
                                     |--> feeds and articles
                                     |--> OPML, backups, logs
```

The [shared contracts](https://github.com/theopnv/monfil/tree/main/src/shared) define data and IPC types for both sides. The main process owns network, database, and filesystem work. The preload bridge exposes a restricted set of methods to the renderer.

## Find the owning folder

| Area | What you will find |
| --- | --- |
| [Main](https://github.com/theopnv/monfil/tree/main/src/main) | Startup, windows, network, feeds, SQLite, filesystem, and IPC handlers |
| [Preload](https://github.com/theopnv/monfil/tree/main/src/preload) | The bridge exposed as `window.electron` |
| [Renderer](https://github.com/theopnv/monfil/tree/main/src/renderer) | React routes, reader, state, and UI |
| [Shared](https://github.com/theopnv/monfil/tree/main/src/shared) | Data contracts, channels, results, and errors |
| [Feedpacks](https://github.com/theopnv/monfil/tree/main/feedpacks) | Curated OPML and catalog metadata |
| [Documentation](https://github.com/theopnv/monfil/tree/main/doc) | Astro Starlight site |

In main, start with [feed work](https://github.com/theopnv/monfil/tree/main/src/main/feed), [database work](https://github.com/theopnv/monfil/tree/main/src/main/db), [OPML](https://github.com/theopnv/monfil/tree/main/src/main/opml), [feedpacks](https://github.com/theopnv/monfil/tree/main/src/main/feedpacks), [logging](https://github.com/theopnv/monfil/tree/main/src/main/logging), or [IPC](https://github.com/theopnv/monfil/tree/main/src/main/ipc). In the renderer, [routes](https://github.com/theopnv/monfil/tree/main/src/renderer/routes) choose views; providers and query hooks hold UI state.

The [Forge configuration](https://github.com/theopnv/monfil/blob/main/forge.config.ts) and process Vite configs control the build.
