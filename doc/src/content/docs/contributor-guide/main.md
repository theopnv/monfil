---
title: Main process
description: Startup, background work, and security boundaries.
sidebar:
  order: 4
---

The [main process](https://github.com/theopnv/monfil/tree/main/src/main) starts Electron, opens the database, registers IPC, creates the window, and schedules feed refreshes. It owns Node.js APIs. Put network requests, filesystem work, and SQLite access here; the renderer reaches them through the [IPC API](../api/).

## Follow a feed refresh

The scheduler reads the stored refresh settings and arms a timer. Each cycle fetches feeds through their adapters, saves new items, removes expired ones, and reports a summary. Image enrichment can continue after the feed list returns. See [Feed sources](../feed-sources/) for the adapter path.

When the reader requests an article body through `items:get-content`, main extracts and stores it for later reads.

:::caution[Untrusted content]
Keep third-party HTML behind the sanitization path before it reaches the reader. Changes to item links must preserve the private-network check.
:::

## Keep network and window boundaries

The [network helpers](https://github.com/theopnv/monfil/tree/main/src/main/lib) accept HTTP and HTTPS URLs and check redirects. [Window security](https://github.com/theopnv/monfil/blob/main/src/main/window-security.ts) keeps app windows on the app document, denies web permissions, and opens external links in the system browser.

The renderer's Vite config supplies the Content Security Policy. Run the [window security tests](https://github.com/theopnv/monfil/blob/main/test/e2e/window-security.spec.ts) when you change URL handling or window behavior.
