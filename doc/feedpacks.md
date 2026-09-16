# Feedpacks

A feedpack is a curated set of sources for one technical area, for example CI/CD, test automation and developer
tooling. An engineer installs a pack and follows what changes in their field without a social media feed in the way.

This document records the design decisions and the order they are built in. It describes the target state, not the
current one.

## Model

### A pack is a workspace

Installing a pack creates a **workspace**: a named tab in the leftmost rail, with its own icon, colour and
categories. Home is the workspace the user did not install and cannot delete.

A workspace and an installed pack are one table, not two. `workspace` carries `source_slug` and `source_version`,
both nullable. Home leaves them null. A workspace created from a plain OPML import leaves them null too.

`source_slug` and `source_version` are provenance. They drive one line of display text and nothing else. A pack is a
frozen snapshot: there is no update check, no re-sync, no merge against a newer version of the pack. A workspace is
fully the user's after install. They add feeds, rename categories, delete categories, and move feeds between them.

That choice has a cost. A source whose URL rots after install stays broken, and nothing repairs it. Surfacing that
is tracked in [#48](https://github.com/theopnv/monfil/issues/48). Until it lands, a pack source that fails uses the
same per-feed error path as any other feed.

### Identity is separate from placement

A feed is one row per URL, forever. `feedMetadata.link` stays unique. Where a feed appears is a separate table:

```
feedPlacement(feed_id, category_id, workspace_id, showInHome)
```

`category_id` and `showInHome` leave `feedMetadata`. `feedCategory` gains `workspace_id`, and its unique constraint
moves from `name` to `(workspace_id, name)`.

Two packs that both carry the GitHub Security Blog share one feed row, one fetch, and one read state. The article is
read once. Without this, a source common to two packs either gets duplicated (two fetches, two read states, unread
counts the user stops trusting) or gets dropped from the second pack, leaving a hole in something the user installed
as a whole.

`workspace_id` sits on `feedPlacement` directly rather than being reached through `feedCategory`. The unique
constraint and the river's where clause both need it, and joining for it on every query is waste.

**A feed has at most one placement per workspace.** The unique constraint is `(feed_id, workspace_id)`. This keeps
folders meaning what folders have always meant, and it is what makes the river join safe: `queryRiverPage` joins
placements filtered to the active workspace, so each item matches exactly one row and the category pill on the card
is well defined. Allowing several placements per workspace would fan the join out again and break the `limit + 1`
cursor at `src/main/db/crud/query.ts:235`.

Uninstalling a workspace deletes its categories and its placements. A feed the user had also placed in Home keeps
that placement and survives. A feed left with zero placements is collected. No special case required.

### Rivers are per tab

Each tab renders its own river over its own feeds. Home never shows pack items, so installing a pack cannot flood
the reading the user built by hand. A release-notes firehose only ever drowns its own tab.

The rail shows a dot when a workspace has something new. It shows no number. A pack's backlog is not a debt the user
incurred, and four tabs carrying counts in the hundreds is how a reader becomes stressful. Per-folder and per-feed
counts inside the sidebar are unaffected.

## Format

A pack is plain OPML. One file, one pack.

OPML 2.0 does not mandate folders, but every reader that matters implements them the same way: an `<outline>` with
no `xmlUrl` that contains other outlines is a folder. Feedly, Inoreader, NetNewsWire, Reeder and Miniflux all read
and write that shape. Each folder outline becomes a category in the new workspace. Category names are scoped per
workspace, so two packs can both have a "Testing" category without colliding.

Icon and colour are not in the file. The user picks them at install.

Catalog metadata that OPML cannot carry lives in one `feedpacks/index.json`:

```json
{
  "version": 1,
  "packs": [
    {
      "slug": "modern-software-delivery",
      "title": "Modern Software Delivery",
      "description": "...",
      "tags": ["ci-cd", "testing"],
      "curator": "...",
      "sourceCount": 44,
      "updatedAt": "2026-03-01",
      "opml": "modern-software-delivery.opml"
    }
  ]
}
```

The index holds metadata only. Opening a pack in the browser fetches its `.opml` to list the sources. Inlining every
source of every pack buys cross-pack source search, which has no value at six packs and costs on every load. The
index is a strict subset of the fatter shape, so a search index can be added later without breaking it.

`version` is at the document root from the first commit, because the index is fetched at runtime and old binaries
parse it forever. An unknown major version must produce a readable message, not a parse error. `sourceCount` is
verified against the OPML in CI: a denormalized count the user can see is a count that must not drift.

## Distribution

The catalog is fetched from GitHub at runtime, cached on disk, with the bundled copy as the offline fallback. The
fetch happens when the user opens the pack browser and at no other time. A user who never opens it never talks to
GitHub.

Bundling the catalog into the binary was rejected because it ties pack curation to the release cadence. A merged
pack would be invisible until the next build on three platforms, which turns a ten-minute contribution into an
unbounded wait. Link rot is continuous and must be fixable without shipping a binary.

This does not make monfil non-local. There is no account and no server holding the user's data. The launch path
stays offline.

There is no submission process yet. The first packs are written in-repo, by hand. CI checks that every `xmlUrl`
resolves. There is no rule on source count, publishing frequency, or category count. A community tier, separated
visibly from curated packs in the browser, is the shape to grow into once contributions actually arrive.

Sharing a pack does not need the catalog at all: a user curates a workspace, exports it as OPML, and sends the file.

## OPML import and export

Pack install and OPML import are the same operation. Both parse an OPML file, create categories, place feeds, and
refresh. Install sets `source_slug`; a plain import leaves it null.

**Import** asks the user for a target: a new workspace, or merge into Home. Merging into Home follows three rules:

- a feed already placed in Home is skipped, and reported
- an imported folder whose name matches an existing Home category merges into it
- a feed new to Home lands in its imported folder, created if missing

**Export** writes one workspace per file. Category names are written as-is, with no workspace prefix. The emitted
shape is one level of folder nesting, which is what every other reader reads. Nesting workspaces as a second level
would round-trip through monfil and degrade everywhere else, which defeats the point of exporting OPML.

OPML is not a backup format. The SQLite file is, and `listenToRevealDatabaseFile` (`src/main/ipc/listeners.ts:20`)
already exposes it.

## Install

Install writes rows first and fetches afterwards. One transaction creates the workspace, its categories, the
`feedMetadata` rows (titled from the OPML `text` attribute, with no items), and the placements. The tab appears
immediately. Main then runs the existing refresh over those feed ids.

The existing add-feed path cannot be reused for this. It is renderer-driven: `useFeedValidation` fetches and parses
in the renderer, and `NewFeedInput` ships parsed items over IPC, so `addFeedToDatabase`
(`src/main/db/crud/insert.ts:114`) only inserts. Driving that 44 times from a modal is the wrong shape.
`refreshAllFeeds` (`src/main/feed/refresh.ts:42`) already runs `runWithConcurrency` in main and already writes
`last_error` per feed.

Install is therefore atomic, works offline, and routes failures into the error path that already exists. The new tab
needs an explicit loading state: a blank river for thirty seconds reads as a broken pack.
