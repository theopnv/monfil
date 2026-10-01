---
title: Feed sources
description: Add a source type and follow the refresh path.
sidebar:
  order: 8
---

Monfil defines a `Source` and a corresponding `SourceAdapter` for each content type. Sources include RSS, Youtube.

`src/main/feed/sources/` holds the RSS and YouTube adapters. The RSS adapter also parses Atom, RDF, and JSON Feed. Each adapter implements `SourceAdapter` from `types.ts`: `fetch` returns a parsed source or a tagged fetch error, and `parse` handles content without a network request. `fetchesFullArticle` tells the enrichment path whether item links need article extraction.

`registry.ts` maps every `SourceType` to an adapter. `sourceFor` selects one for a stored feed. `resolveSource` selects one for a link the user has entered, with an optional type hint from the Add Feed UI. The registry uses TypeScript's `satisfies` check so a new source type requires an adapter.

```text
User link -> resolveSource -> adapter.fetch -> parsed source -> Add Feed -> database
Stored feed -> sourceFor -> adapter.fetch -> refresh -> items -> river
                                              \-> later image enrichment
Reader item -> content request -> article extraction -> stored body
```

To add a source type, extend `SourceType` in `src/shared/contracts.ts`, add the adapter, register it, and teach `resolveSource` how to recognize its links. Give each item a stable GUID so refresh can recognize it again. Put fields specific to one source in `feedItem.extra`; add a shared column and migration when every source needs the field. Test parsing with fixtures and test the fetch behavior at the adapter boundary.

The refresh scheduler reads its interval from the database. Refresh uses conditional requests when a feed has validators, records per-feed errors, and applies item retention. Keep feed-owned item links behind the private-network check when adding a fetch path. `src/main/feed/refresh.ts`, `src/main/feed/enrichItems.ts`, and `src/main/lib/fetch.ts` show those boundaries.
