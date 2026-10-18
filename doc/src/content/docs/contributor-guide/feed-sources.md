---
title: Feed sources
description: Add a source type and follow the refresh path.
sidebar:
  order: 8
---

Monfil uses a `SourceAdapter` for each source type. The [source adapters](https://github.com/theopnv/monfil/tree/main/src/main/feed/sources) cover RSS, Atom, RDF, JSON Feed, YouTube, GitHub, GitLab, Hacker News, arXiv, Bluesky, Mastodon, and conference milestones from developers.events.

## Follow an item

```text
User link -> resolveSource -> adapter.discover -> candidates -> Add Feed -> database
Stored feed -> sourceFor -> adapter.fetch -> refresh -> items -> river
                                              \-> later image enrichment
Reader item -> content request -> article extraction -> stored body
```

An adapter has two network methods:

- `discover` takes the raw text from Add Feed. It returns one or more parsed candidates, with the default first, or a tagged error. The wizard shows a list when there is more than one candidate.
- `fetch` takes a stored feed URL and refreshes it. It does not rewrite the URL and does not fetch icons again.

The `matches` method tells the registry whether raw text belongs to the source when the user picks no chip. It must not make a network request. The `parse` method handles content without a network request. `fetchesFullArticle` tells the enrichment path whether an item link needs article extraction.

The [registry](https://github.com/theopnv/monfil/blob/main/src/main/feed/sources/registry.ts) picks an adapter for a stored feed or a link entered in Add Feed. `resolveSource` checks each adapter's `matches` in a fixed order, and RSS takes the rest. `detectType` finds the type of a known feed URL, such as an OPML `xmlUrl`.

## Find a feed behind a page

The RSS adapter's `discover` tries these steps in order:

1. If the path looks like a Mastodon profile or tag, it tries the `.rss` URL as a Mastodon feed. Any host can run Mastodon, so the host alone cannot tell.
2. If the link itself parses as a feed, it uses the link.
3. It reads the `<link rel="alternate">` feed tags on the page and fetches up to five of them.
4. It tries common feed paths on the page origin and stops at the first one that parses.

## Add a source type

1. Add the type to `SOURCE_TYPES` in the [shared contracts](https://github.com/theopnv/monfil/blob/main/src/shared/contracts.ts).
2. If the source publishes an ordinary feed, build the adapter with `createFeedSource` in `feedSource.ts`. Give it a `toCandidates` function that changes a page link into feed URLs. Add `transform` for platform parse rules and `resolveIcon` for an avatar. Write a full adapter only when the source needs its own fetch, as YouTube does.
3. Register the adapter in the registry, add it to the detection order, and teach `detectType` its feed URLs.
4. Add a chip and its copy to Step 1 of Add Feed, a badge word to the river labels, and a reader strategy. The `Record<SourceType, …>` maps fail the build until each entry exists.
5. Give each item a stable GUID so a later refresh can find it again.
6. Test `toCandidates` for each input shape, test parsing with fixtures, and test `discover` at the adapter boundary.

Keep fields that only this source uses in `feedItem.extra`. When every source needs a field, add a shared column and migration.

:::caution[Keep the fetch boundary]
Refresh uses conditional requests, records errors for each feed, and applies item retention. When a new path fetches item links, keep the private-network check in the [network helpers](https://github.com/theopnv/monfil/tree/main/src/main/lib). See the [feed workflow](https://github.com/theopnv/monfil/tree/main/src/main/feed) before changing when enrichment runs.
:::
