---
title: Feedpacks and OPML
description: Curated feed lists, import, install, and export.
sidebar:
  order: 9
---

A feedpack is a curated OPML list with catalog metadata. Browse the [feedpacks folder](https://github.com/theopnv/monfil/tree/main/feedpacks) for examples, or follow the [submission guide](../../user-guide/submit-a-feedpack/) to propose one. Run `npm run check:feedpacks` to check the catalog and OPML files.

## Job packs

A job pack lists company job boards. Name the file `feedpacks/<region>-<sector>-jobs.opml`, for example `paris-tech-jobs.opml`. Each `xmlUrl` is the API URL of a board, as the `ats` adapter stores it, so `detectType` sets the `ats` type by host. Packs only add feeds, and the install flow does not change.

Every company needs a working board and at least one open job in the area when you add it. `npm run check:feedpacks` probes each board of a known job system. It fails on a 404 and warns on an empty board or a network error. Pass `--no-probe` to skip the probe when you are offline. Many employers use systems that Monfil does not read, such as Workday, SuccessFactors, and Taleo, so a pack for a sector like banking can be small.

## Browse and install a pack

The browser asks the main process for a catalog and preview. The [feedpack code](https://github.com/theopnv/monfil/tree/main/src/main/feedpacks) fetches the catalog when needed, caches it on disk, and can fall back to the bundled copy. Installing a pack sends its OPML through the same import path as a local file.

A user can create a workspace for the pack or merge it into one. After installation, the sources belong to that workspace and can be edited there.

## Import and export

The [OPML code](https://github.com/theopnv/monfil/tree/main/src/main/opml) parses the file, imports feeds into a new or existing workspace, and refreshes them. A feed has one database row per URL. Importing it again can add a placement without copying its articles. The parser sets each feed's source type from its `xmlUrl` with the registry's `detectType`, so a feedpack entry needs only the final feed URL. Mastodon feeds import as RSS because their host does not identify them.

Export writes one workspace as OPML. It includes the feed list and folders.
