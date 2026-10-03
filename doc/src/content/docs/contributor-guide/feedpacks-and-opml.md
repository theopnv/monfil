---
title: Feedpacks and OPML
description: Curated feed lists, import, install, and export.
sidebar:
  order: 9
---

A feedpack is a curated OPML list with catalog metadata. Browse the [feedpacks folder](https://github.com/theopnv/monfil/tree/main/feedpacks) for examples, or follow the [submission guide](../../user-guide/submit-a-feedpack/) to propose one. Run `npm run check:feedpacks` to check the catalog and OPML files.

## Browse and install a pack

The browser asks the main process for a catalog and preview. The [feedpack code](https://github.com/theopnv/monfil/tree/main/src/main/feedpacks) fetches the catalog when needed, caches it on disk, and can fall back to the bundled copy. Installing a pack sends its OPML through the same import path as a local file.

A user can create a workspace for the pack or merge it into one. After installation, the sources belong to that workspace and can be edited there.

## Import and export

The [OPML code](https://github.com/theopnv/monfil/tree/main/src/main/opml) parses the file, imports feeds into a new or existing workspace, and refreshes them. A feed has one database row per URL. Importing it again can add a placement without copying its articles.

Export writes one workspace as OPML. It includes the feed list and folders.
