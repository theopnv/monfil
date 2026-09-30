# Sources

A *source* is one type of thing a user can subscribe to: RSS, podcasts, subreddits, Bluesky feeds or plain websites.

Each type is one adapter in `src/main/feed/sources/`. Nothing outside that directory names a format.

## The interface

`src/main/feed/sources/types.ts` declares `SourceAdapter`:

```ts
interface SourceAdapter {
  readonly type: SourceType;
  readonly fetchesFullArticle: boolean;
  fetch(input: SourceFetchInput): Promise<Result<SourceFetchResult, FeedFetchError>>;
  parse(content: string): { title; description; items } | null;
}
```

`fetch` is what the app calls. `parse` is exported separately so a test can exercise the parsing without the network.

`fetchesFullArticle` tells the enrichment step (`enrichItems`, called from `handleFeedsSubmitAddFeed` and `refresh.ts`) whether it should fetch each item's own link and run Readability on it. `rss` is `true`; `youtube` is `false`, since a YouTube watch page is a 1.3 MB download and the description is already the full text.

`ParsedSource` is what both the Add Feed wizard and the refresh loop receive: a `type`, a `link`, a `title`, a `description`, an `icon`, and the items. It is derived from `FeedMetadata`, so a new column on `feedMetadata` shows up here as a compile error rather than a silent gap.

`src/main/feed/sources/text.ts` holds the text helpers every adapter needs: `decodeText`/`decodeOptional` (HTML entity decoding for titles and descriptions) and `resolveGuid` (the guid → link → digest fallback chain).

## The registry

`src/main/feed/sources/registry.ts` holds the map:

```ts
const sources = { rss: rssSource, youtube: youtubeSource } satisfies Record<SourceType, SourceAdapter>;
```

`satisfies` is the exhaustiveness guard. Adding a member to `SourceType` breaks the build here until an adapter exists for it.

Two lookups come out of it:

- `sourceFor(type)` — the adapter that owns a feed already in the database, read from its `type` column.
- `resolveSource(link, hint?)` — the adapter for a link the user has just typed, before anything is stored. `hint` is the Step 1 toggle: when the user has picked a type explicitly, it wins outright. Otherwise the link's host decides, via `isYoutubeLink` from `youtube.ts`. A bare handle or channel id carries no host, so it only resolves as YouTube when the toggle supplies the hint.

## Adding a type

1. Add the member to `SourceType` in `src/main/db/types.ts`. The build breaks in the registry.
2. Write the adapter next to `rss.ts`. Give every item a stable `guid`: the identity the source itself publishes, falling back to the link, falling back to a digest.
3. Register it in `sources`.
4. Teach `resolveSource` to recognise the link.

No migration is needed for a field only your type carries. Put it in `feedItem.extra`, which is a JSON blob for exactly that. A field that every type carries deserves its own column, and `CriteriaHandlers` will make the compiler ask for the handler.

## YouTube traps

`youtube.ts` fetches an Atom feed (`feeds/videos.xml`) same as `rss.ts`, but two things about it are easy to get wrong:

- **The feed's own `<yt:channelId>` is truncated** (the `UC` prefix goes missing) on a *channel* feed. The adapter never relies on it there — the id is already known before that feed is ever fetched. A *playlist* feed does not have this bug, and `extractPlaylistOwner` reads it there to find the owning channel.
- **Thumbnails and the description live under `media:group`** (`entry.media.groups[0]`), not directly under `media:thumbnails` / `media:description` the way `extractAtomImageUrl` expects for a plain Atom feed.
