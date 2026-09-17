# Backend

`src/main` is the Electron main process. It owns:
- The application lifecycle
- The windows
- The network
- The database.

It is the only process with Node APIs. The renderer must never reach for them.

## Window hardening

The renderer shows HTML from third-party feeds, so each window is locked to the app's own document. `src/main/window-security.ts` denies every new window (a middle-clicked link goes to the OS browser instead), blocks navigation away from the loaded document, and refuses every web permission. `vite.renderer.config.mts` injects a Content Security Policy `<meta>` tag into `index.html`; the packaged app loads from `file://`, where a header cannot carry it. The dev server gets a looser policy because it injects the React refresh preamble inline and reloads over a websocket. `test/e2e/window-security.spec.ts` checks all of this against the packaged app.
