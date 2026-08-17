# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                 # electron-forge dev run (Vite dev server + Electron)
npm run lint              # tsc -b . && eslint  (also the pre-commit hook)
npm test                  # unit (vitest), integration (vitest browser mode), then e2e (playwright); packaging runs in pretest
npm run package           # build into .vite/build ; required before e2e tests
npm run make              # platform installers in out/<os>
```

Single tests:

```bash
npx vitest run src/main/db/query.test.ts        # one unit test file
npx vitest run -t "filters by name"             # one unit test by name
npx playwright test test/e2e/settings.spec.ts   # one e2e file
```

Playwright launches the built app, not the sources. It reads `main` from `package.json`, which points into `.vite/build`. Run `npm run package` after a change, or the e2e tests
run against old code.

In VS Code, use the `Main + renderer` compound launch configuration to debug both processes.

When you are tasked with fixing a bug, always write a test reproducing the issue first. This gives confidence the fix actually works.

## Architecture

Electron with three source trees, each built by its own Vite config. See `forge.config.ts`.

- `src/main`: the Node side. Network, parsing, database. See [doc/backend.md](doc/backend.md) and [doc/database.md](doc/database.md).
- `src/preload`: the context bridge. It exposes `window.electron.ipcRenderer`.
- `src/renderer`: the React app. See [doc/frontend.md](doc/frontend.md).

### IPC contract

`src/preload/channels.ts` declares the payload of every channel. Both sides import it, so a mismatch fails to compile. Do not type a payload at a call site.

## Conventions

- Type-only imports need the `type` keyword. The root `tsconfig.json` is strict: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `verbatimModuleSyntax`.
- The `@/` alias points at `src/renderer/` only. It is declared twice, in `tsconfig.json` and in `vite.renderer.config.mts`. Keep them in step.
- Fallible operations return the `Result` union from `src/utils.ts` instead of throwing. Errors are tagged unions with a `name` field. Discriminate them with a `switch` that ends in a `never` exhaustiveness check, as in `src/main/feed/parse.ts`.
- Documentation files use kebab-case names and live in `doc/`.
- Use JSDoc @params and @return to document functions (only the important, external facing APIs or helpers).

### Test conventions
- Unit tests sit next to the code they cover (`file.test.ts`) and e2e tests live in `test/e2e/` (`file.spec.ts`).
- Tests mark their steps with `// Arrange`, `// Act`, `// Assert` comments.
- Use fixtures when possible, and/or setup/teardown hoos (before/after). Do not just call regular functions at the beginning or end of the tests to act as the setup/teardown.
- A good test covers: the successful paths, the error paths and the edge case paths (boundaries, no or empty input, ...)
- Don't overmock. Don't test the internals of the code under testing, test the contract (input + output) visible from the outside.
- For vitest mocks, always use `vi.mock(import('./module.ts'))` instead of `vi.mock('./module.ts')`. This ensures type safety with typescript.
- Prefer short test names.
