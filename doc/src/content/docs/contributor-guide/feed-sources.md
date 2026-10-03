---
title: Feed sources
description: Add a source type and follow the refresh path.
sidebar:
  order: 8
---

Monfil uses a `SourceAdapter` for each source type. The [source adapters](https://github.com/theopnv/monfil/tree/main/src/main/feed/sources) cover RSS, Atom, RDF, JSON Feed, and YouTube.

## Follow an item

```text
User link -> resolveSource -> adapter.fetch -> parsed source -> Add Feed -> database
Stored feed -> sourceFor -> adapter.fetch -> refresh -> items -> river
                                              \-> later image enrichment
Reader item -> content request -> article extraction -> stored body
```

An adapter's `fetch` method returns a parsed source or a tagged error. Its `parse` method handles content without a network request. `fetchesFullArticle` tells the enrichment path whether an item link needs article extraction. The [registry](https://github.com/theopnv/monfil/blob/main/src/main/feed/sources/registry.ts) picks an adapter for a stored feed or a link entered in Add Feed.

## Add a source type

1. Extend `SourceType` in the [shared contracts](https://github.com/theopnv/monfil/blob/main/src/shared/contracts.ts).
2. Add an adapter and register it. Teach `resolveSource` to recognize its links.
3. Give each item a stable GUID so a later refresh can find it again.
4. Test parsing with fixtures and test fetch behavior at the adapter boundary.

Keep fields that only this source uses in `feedItem.extra`. When every source needs a field, add a shared column and migration.

:::caution[Keep the fetch boundary]
Refresh uses conditional requests, records errors for each feed, and applies item retention. When a new path fetches item links, keep the private-network check in the [network helpers](https://github.com/theopnv/monfil/tree/main/src/main/lib). See the [feed workflow](https://github.com/theopnv/monfil/tree/main/src/main/feed) before changing when enrichment runs.
:::
