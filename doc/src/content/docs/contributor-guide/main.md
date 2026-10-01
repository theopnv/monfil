---
title: Main process
description: Startup, background work, and security boundaries.
sidebar:
  order: 4
---

`src/main/main.ts` starts the Electron app. Main responsibilities:

- Data directory
- Logging
- Database
- Registering IPC
- Creating a window
- Feed refresh scheduler

The main process owns Node.js APIs. Put network requests, filesystem work, and SQLite access here. The renderer reaches them through the [IPC API](../api/).

## Feed work

`src/main/feed/scheduler.ts` runs refreshes on a timer or at launch, based on stored settings. `src/main/feed/refresh.ts` gets the stored feeds, asks the right source adapter to fetch each one, writes new items, prunes old items, and reports a summary. Image enrichment can finish after the feed list returns.
See [Feed sources](../feed-sources/).

The reader can request an article's body through `items:get-content`. Article extraction runs outside the renderer. The main process stores the extracted result for later reads. Keep third-party HTML behind the existing sanitization path before it reaches the reader.

## Network and windows

`src/main/lib/fetch.ts` is the shared outbound fetch path. It accepts HTTP and HTTPS URLs and checks each redirect. Fetches of item links use the private-network guard in `src/main/lib/private-network.ts`.

`src/main/window-security.ts` keeps app windows on the app document, denies web permissions, and sends external links to the system browser. The renderer's Vite config supplies the Content Security Policy. Changes to URL handling, article content, or window creation must keep these boundaries intact. The packaged app's window behavior is covered by `test/e2e/window-security.spec.ts`.
