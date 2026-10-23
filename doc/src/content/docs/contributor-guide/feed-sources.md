---
title: Feed sources
description: Add a source type and follow the refresh path.
sidebar:
  order: 8
---

Monfil uses a `SourceAdapter` for each source type. The [source adapters](https://github.com/theopnv/monfil/tree/main/src/main/feed/sources) cover RSS, Atom, RDF, JSON Feed, YouTube, GitHub, GitLab, Hacker News, arXiv, Bluesky, Mastodon, conference milestones from developers.events, and job boards on applicant tracking systems.

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

## Job boards

An [applicant tracking system (ATS)](https://www.sap.com/resources/what-is-an-applicant-tracking-system) is a software application that companies use to digitally manage their hiring and recruitment workflows. Monfil uses ATS providers such as Greenhouse, Lever or Ashby to gather all the job postings users are interested in.

The `ats` source type reads the public job board of a company. One adapter in `src/main/feed/sources/ats/` serves every applicant tracking system. A small file in `providers/` holds the rules of one system:

- `toBoard` takes a board page or API URL and returns the provider, the company slug, and the API URL, without any network request. The API URL is the identity of the stored feed.
- `normalize` reads the API response into a common job shape. It returns `null` when the response is not in that provider's shape.

The adapter turns each job into an item. The title is the job title, the author is the company, and the description is the posting HTML. The date is the first publication date when the system gives one. Otherwise the date stays empty and the first-seen time applies, because dates such as `updated_at` change on every edit. The `extra` JSON holds the provider, company, location, work mode, salary label, department, and employment type. `queryRiverPage` reads `extra` for `ats` rows only and returns it as `RiverRow.job`, which the river cards show.

`salary.ts` reads a pay label from a structured field or from the posting text. `workMode.ts` reads the provider field, or keywords in the location and the title. Both only feed the card label. Neither is a search filter.

Job pages are often single-page apps that Readability cannot read, so `fetchesFullArticle` is `false`. A board larger than the 10 MB fetch limit fails with `RESPONSE_TOO_LARGE_ERROR`. SmartRecruiters returns the first 100 postings, and its API URL keeps the `country`, `region`, `city`, `department`, and `q` filters.

To add a provider, add a file in `providers/`, list it in `providers/index.ts`, and test `toBoard` and `normalize` with a recorded response. Check the endpoint by hand first, because these APIs are not versioned for third parties.

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
