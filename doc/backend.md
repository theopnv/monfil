# Backend

`src/main` is the Electron main process. It owns the application lifecycle, the windows,
the network, and the database. It is the only process with Node APIs. The renderer must
never reach for them.

## Files

| File | Holds |
| --- | --- |
| `src/main/main.ts` | App lifecycle and window creation. |
| `src/main/run.ts` | The work done once the window is ready. |
| `src/main/ipcHandle.ts` | Handlers for channels the renderer invokes. |
| `src/main/ipcSend.ts` | The typed wrapper for pushing to the renderer. |
| `src/main/fetch.ts` | Network access. |
| `src/main/feed/` | Feed parsing. |
| `src/main/db/` | Reads and writes. See [doc/database.md](database.md). |

Keep `main.ts` limited to lifecycle. Startup work belongs in `run.ts`, so that the parts
stay testable without an Electron instance.

## Startup order

1. Register the IPC handlers. Do this before the window exists, because the renderer can
   invoke a channel as soon as it loads.
2. Create the window.
3. Wait for `did-finish-load`, then run the startup work.

Step 3 matters. The renderer subscribes to its channels when it mounts, so anything
pushed before that point is lost. Never send from the `ready` event.

## Errors do not throw

A function that can fail returns the `Result` union from `src/utils.ts`. The error side is
a tagged union with a `name` field, as in the `FetchUrlError` union in `fetch.ts`.

Handle those unions with a `switch` on `name` that ends in a `never` exhaustiveness
check. Add a new error case, and every incomplete `switch` stops compiling. See
`getFeedItems` in `src/main/feed/parse.ts`.

Reserve `try`/`catch` for the boundary with an API that throws, such as `fetch` or a
parser. Convert what you catch into a `Result` at once, and do not let it propagate.

## Talking to the renderer

Send through `sendToRenderer`, never through `webContents.send` directly. The wrapper
takes the channel and its payload from `src/preload/channels.ts`, so a wrong payload
fails to compile.

Send results one item at a time when the work is a loop over sources. The renderer shows
each one as it lands, and a slow source does not hold back the rest. This means a failure
is per item, so send a failed `Result` for that item rather than dropping the whole batch.

## Parsing

A parser converts a foreign format into the row shape the database expects. It takes a
string and returns plain data. Keep the network out of it, so the parser can be tested
with a fixture string. `fetch.ts` gets the bytes, and `feed/parse.ts` interprets them.

Feed formats vary, and fields that look required are often absent. Supply a default for
every optional field at the parse boundary. Do not push `undefined` further in.

## Packaging

The main process is bundled by `vite.main.config.mts`. A native dependency has to be
listed as `external` there, because it resolves its `.node` binary against its own package
directory. Bundling it breaks the load, and only at runtime.

Electron fuses are set in `forge.config.ts`. They turn off `RunAsNode`, the inspect
arguments, and loading from outside the asar. Leave them off. Node integration in the
renderer stays off as well, and the context bridge is the only path between the processes.

## Tests

Unit tests are vitest, and sit next to the code they cover. They import the real modules,
including the database singleton. Anything that needs a window belongs in the e2e tests
instead.
