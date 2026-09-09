# Sources

A *source* is one type of thing a user can subscribe to: RSS, podcasts, subreddits, Bluesky feeds or plain websites.

Each type is one adapter in `src/main/feed/sources/`. Nothing outside that directory names a format.

## The interface

`src/main/feed/sources/types.ts` declares `SourceAdapter`:

```ts
interface SourceAdapter {
  readonly type: SourceType;
  fetch(link: string, maxItems?: number): Promise<Result<ParsedSource, FeedFetchError>>;
  parse(content: string, maxItems?: number): { title; description; items } | null;
}
```

`fetch` is what the app calls. `parse` is exported separately so a test can exercise the parsing without the network.

`ParsedSource` is what both the Add Feed wizard and the refresh loop receive: a `type`, a `link`, a `title`, a `description`, and the items. It is derived from `FeedMetadata`, so a new column on `feedMetadata` shows up here as a compile error rather than a silent gap.

## The registry

`src/main/feed/sources/registry.ts` holds the map:

```ts
const sources = { rss: rssSource } satisfies Record<SourceType, SourceAdapter>;
```

`satisfies` is the exhaustiveness guard. Adding a member to `SourceType` breaks the build here until an adapter exists for it.

Two lookups come out of it:

- `sourceFor(type)` — the adapter that owns a feed already in the database, read from its `type` column.
- `resolveSource(link)` — the adapter for a link the user has just typed, before anything is stored. It returns the RSS adapter today. This is where a second type gets detected from the URL.

## Adding a type

1. Add the member to `SourceType` in `src/main/db/types.ts`. The build breaks in the registry.
2. Write the adapter next to `rss.ts`. Give every item a stable `guid`: the identity the source itself publishes, falling back to the link, falling back to a digest.
3. Register it in `sources`.
4. Teach `resolveSource` to recognise the link.

No migration is needed for a field only your type carries. Put it in `feedItem.extra`, which is a JSON blob for exactly that. A field that every type carries deserves its own column, and `CriteriaHandlers` will make the compiler ask for the handler.
