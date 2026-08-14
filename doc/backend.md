# Backend

`src/main` is the Electron main process. It owns the application lifecycle, the windows, the network, and the database. It is the only process with Node APIs. The renderer must never reach for them.

## Files

| File | Holds |
| --- | --- |
| `src/main/main.ts` | App lifecycle and window creation. |
| `src/main/ipc/registerIpcHandlers.ts` | Two-way (`invoke`/`handle`) channel handlers. |
| `src/main/ipc/registerIpcListeners.ts` | One-way (renderer -> main) channel listeners. |
| `src/main/fetch.ts` | Network access. |
| `src/main/feed/` | Feed parsing. |
| `src/main/db/` | Reads and writes. See [doc/database.md](database.md). |

Keep `main.ts` limited to lifecycle: registering IPC handlers, creating the window, and wiring `app.on(...)` events.

## Startup order

1. Register the IPC handlers. Do this before the window exists, because the renderer can invoke a channel as soon as it loads.
2. Create the window.

There is no explicit "startup work" step. The renderer pulls what it needs through `invoke` once it mounts (see `feeds-provider.tsx`), rather than main pushing data as soon as the window is ready. This sidesteps a real race: `webContents.send` has no buffering, so a push sent before the renderer's listener attaches is silently lost. Prefer `invoke` for anything the renderer needs at startup, for that reason.

## Errors do not throw

A function that can fail returns the `Result` union from `src/utils.ts`. The error side is a tagged union with a `name` field, as in the `FetchUrlError` union in `fetch.ts`.

Handle those unions with a `switch` on `name` that ends in a `never` exhaustiveness check. Add a new error case, and every incomplete `switch` stops compiling. See `getFeedItems` in `src/main/feed/parse.ts`.

Reserve `try`/`catch` for the boundary with an API that throws, such as `fetch` or a parser. Convert what you catch into a `Result` at once, and do not let it propagate.

## Talking to the renderer

There is currently no main -> renderer push channel; everything goes through `invoke`/`handle`. A handler's return type is declared in `TwoWayRendererMainChannelPayloads` in `src/preload/channels.ts`, so a wrong payload fails to compile.

If a future feature genuinely needs main to push (e.g. streaming per-item results from a slow loop over sources so a slow one doesn't hold back the rest), that's a one-way main -> renderer channel. Reintroducing it means restoring a typed `sendToRenderer`-style wrapper around `webContents.send`, and being deliberate about timing: `webContents.send` does not buffer, so a message sent before the renderer's `ipcRenderer.on` listener attaches is silently lost. Wait for a readiness signal from the renderer rather than sending as soon as the window is ready.

## Parsing

A parser converts a foreign format into the row shape the database expects. It takes a string and returns plain data. Keep the network out of it, so the parser can be tested with a fixture string. `fetch.ts` gets the bytes, and `feed/parse.ts` interprets them.

Feed formats vary, and fields that look required are often absent. Supply a default for every optional field at the parse boundary. Do not push `undefined` further in.

## Packaging

The main process is bundled by `vite.main.config.mts`. A native dependency has to be listed as `external` there, because it resolves its `.node` binary against its own package directory. Bundling it breaks the load, and only at runtime.

Electron fuses are set in `forge.config.ts`. They turn off `RunAsNode`, the inspect arguments, and loading from outside the asar. Leave them off. Node integration in the renderer stays off as well, and the context bridge is the only path between the processes.

## Tests

Unit tests are vitest, and sit next to the code they cover. They import the real modules, including the database singleton. Anything that needs a window belongs in the e2e tests instead.
