# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                 # electron-forge dev run (Vite dev server + Electron)
npm run lint              # tsc -b . && eslint  (also the pre-commit hook)
npm test                  # vitest --run, then playwright; `pretest` packages first
npm run package           # build into .vite/build ; required before e2e tests
npm run make              # platform installers in out/<os>
```

Single tests:

```bash
npx vitest run src/main/db/query.test.ts        # one unit test file
npx vitest run -t "filters by name"             # one unit test by name
npx playwright test test/e2e/settings.spec.ts   # one e2e file
```

Playwright launches the built app, not the sources. It reads `main` from `package.json`,
which points into `.vite/build`. Run `npm run package` after a change, or the e2e tests
run against old code.

In VS Code, use the `Main + renderer` compound launch configuration to debug both
processes.

## Architecture

Electron with three source trees, each built by its own Vite config. See
`forge.config.ts`.

- `src/main`: the Node side. Network, parsing, database. See
  [doc/backend.md](doc/backend.md) and [doc/database.md](doc/database.md).
- `src/preload`: the context bridge. It exposes `window.electron.ipcRenderer`.
- `src/renderer`: the React app. See [doc/frontend.md](doc/frontend.md).

### IPC contract

`src/preload/channels.ts` declares the payload of every channel. Both sides import it, so
a mismatch fails to compile. Do not type a payload at a call site.

To add a channel, add its payload to `ChannelPayloads`. If the renderer calls it with
`invoke`, also add the name to `InvokeChannels` and add an entry to the `handlers` map in
`src/main/ipcHandle.ts`. The map is keyed by that union, so a missing handler is a
compile error.

Main sends to the renderer through `sendToRenderer`, never through
`webContents.send` directly. Wait for the window to finish loading before the first send.
The renderer subscribes when it mounts, and anything sent earlier is lost.

## Conventions

- Type-only imports need the `type` keyword. The root `tsconfig.json` is strict beyond
  the usual: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `verbatimModuleSyntax`.
- The `@/` alias points at `src/renderer/` only. It is declared twice, in `tsconfig.json`
  and in `vite.renderer.config.mts`. Keep them in step.
- Fallible operations return the `Result` union from `src/utils.ts` instead of throwing.
  Errors are tagged unions with a `name` field. Discriminate them with a `switch` that
  ends in a `never` exhaustiveness check, as in `src/main/feed/parse.ts`.
- Documentation files use kebab-case names and live in `doc/`.
- Tests sit next to the code they cover, except e2e tests, which live in `test/e2e/`.
  E2E tests get their setup and teardown from a Playwright fixture, and mark their steps
  with `// Arrange`, `// Act`, `// Assert` comments.

## Publishing

Push a tag matching `v*`. The workflow builds on three platforms and opens a draft GitHub
release. Publishing that draft only changes its visibility, and nothing rebuilds.
