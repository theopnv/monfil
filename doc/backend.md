# Backend

`src/main` is the Electron main process. It owns:
- The application lifecycle
- The windows
- The network
- The database.

It is the only process with Node APIs. The renderer must never reach for them.

## Window hardening

The renderer shows HTML from third-party feeds, so each window is locked to the app's own document. `src/main/window-security.ts` denies every new window (a middle-clicked link goes to the OS browser instead), blocks navigation away from the loaded document, and refuses every web permission. `src/renderer/vite.config.mts` injects a Content Security Policy `<meta>` tag into `index.html`; the packaged app loads from `file://`, where a header cannot carry it. The dev server gets a looser policy because it injects the React refresh preamble inline and reloads over a websocket. `test/e2e/window-security.spec.ts` checks all of this against the packaged app.

## Outbound fetches

Every request from the main process goes through `fetchUrl` in `src/main/lib/fetch.ts`. It accepts only `http` and `https`, follows redirects one hop at a time, and re-checks each hop, so a feed cannot bounce the app onto another scheme.

URLs that a feed chose, rather than the user, are fetched with `blockPrivateHosts: true`. Today that is every item link: the background enrichment after a refresh and the on-demand fetch when the reader opens an item. Before such a fetch, `src/main/lib/private-network.ts` resolves the host and refuses it when any address falls in a loopback, link-local, private (RFC 1918), shared, unique-local or multicast range. IP literals are checked directly, in every spelling the URL parser accepts. A pack installer must set the same option, since a pack's URLs are not typed by the user either.

Feed URLs that the user typed or imported are fetched without the guard, so a self-hosted feed on the LAN keeps working. Item links from such a feed do not get their article extracted.

Known limit: the check resolves the name once and the connection resolves it again, so a DNS answer that changes between the two is not caught.

The e2e specs serve feeds and article pages from `127.0.0.1`. `main.ts` calls `allowPrivateHosts()` when `E2E_TEST` is set, which turns the guard off for that process.
