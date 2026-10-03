# Working in Monfil

Monfil is a source-available desktop feed reader for macOS, Windows, and Linux. It uses Electron, React, TypeScript, SQLite, and Astro for its documentation site. Keep this file focused on facts and rules that apply across the repository. Use `doc/AGENTS.md` for work in `doc/` and the relevant `.ai/skills/` guide for a specialized workflow.

## Find the right code

- If a local `graft/` index and the `graft` command are available, use them to locate code and trace dependencies before searching source files. Graft is optional and is not included in a fresh clone. Otherwise, use `rg` to find the relevant files. Read only the files needed for the task.
- `src/main/` owns Electron startup, network access, feed parsing and refresh, SQLite, OPML, feedpacks, settings, logging, and IPC handlers.
- `src/preload/` exposes the restricted IPC bridge to the renderer.
- `src/renderer/` owns the React UI. Routes live in `src/renderer/routes/`; providers and query hooks hold UI state.
- `src/shared/` holds contracts and values used across processes. It must not import from a process tree.
- `feedpacks/` contains curated OPML packs and their catalog. `scripts/check-feedpacks.mjs` checks them.
- `doc/src/content/docs/` contains the Astro Starlight site, including the contributor guide. Check current code before relying on documentation.

## Commands

Run commands from the repository root unless a command says otherwise.

| Task | Command |
| --- | --- |
| Start the Electron app | `npm start` |
| Check TypeScript and ESLint | `npm run lint` |
| Run Node unit tests | `npm run test:unit` |
| Run renderer tests in Chromium | `npm run test:integration` |
| Build and run Electron end-to-end tests | `npm run test:e2e` |
| Run all test suites | `npm test` |
| Package the app | `npm run package` |
| Make platform installers | `npm run make` |
| Check feedpacks | `npm run check:feedpacks` |
| Lint public Markdown docs | `npm run lint:docs` |
| Build the documentation site | `npm --prefix doc run build` |

Use `npx vitest run path/to/file.test.ts` for one Node test file. Use `npx vitest run --config=vitest.browser.config.mts path/to/file.test.tsx` for one renderer test file. Use `npx playwright test test/e2e/file.spec.ts` for one end-to-end file.

Playwright launches `.vite/build/main.js`. `npm run test:e2e` packages the current code through its `pretest:e2e` script. Run `npm run package` first when you call `npx playwright test` directly. The full `npm test` command runs the Node, renderer, and Electron suites in that order. The pre-commit hook runs `npm run lint` and also runs `npm run lint:docs` when public Markdown docs are staged.

In VS Code, the `Main + renderer` compound launch configuration debugs both Electron processes. Use `.ai/skills/vm-debug/SKILL.md` when reproducing a Windows or Linux issue in a local VM.

## Code boundaries

- `forge.config.ts` defines the Electron build. The main, preload, and renderer processes have separate Vite and TypeScript configs.
- Define cross-process payloads in `src/shared/channels.ts` and shared data types in `src/shared/contracts.ts`. Keep IPC calls aligned with those contracts; do not add local payload types at call sites.
- Keep network, filesystem, and database access in the main process. Use the preload bridge for renderer requests. Treat feed content and external URLs as untrusted input; preserve the existing fetch, window security, and HTML sanitization boundaries.
- Database queries live in `src/main/db/`. Add schema changes as a new numbered migration and register it in `src/main/db/migrations/index.ts`. Use `.ai/skills/kysely-db/SKILL.md` for database edits.
- Feed source adapters live in `src/main/feed/sources/`. RSS, RDF, JSON Feed, and YouTube feed support share the refresh path. Item enrichment and article extraction run in `src/main/feed/`; retention and backup work live in `src/main/db/`.
- Diagnostic logging and error recovery span `src/main/logging/`, `src/renderer/components/errors/`, and the Settings diagnostics section.
- The renderer uses TanStack Router and TanStack Query. Its `@/` alias points only to `src/renderer/`. Keep the alias declarations in the renderer TypeScript, Vite, and vendored UI configs aligned.
- Use `type` for type-only imports. Use the `Result` union in `src/shared/result.ts` for expected failures. Handle tagged errors by `name` and keep exhaustive switches exhaustive.

## Changes and checks

- For a bug fix, first add a test that fails for the reported behavior. Then fix the code and run the affected test again.
- Keep unit tests next to source as `*.test.ts` or `*.test.tsx`. Put Electron end-to-end tests in `test/e2e/*.spec.ts`. Renderer component tests run in Vitest Browser Mode, not the Node suite.
- Test observable behavior. Use fixtures and setup or teardown hooks when they help. Mark test phases with `// Arrange`, `// Act`, and `// Assert`. Use `vi.mock(import('./module.ts'))` for Vitest module mocks.
- Run focused checks for the area you changed. Run `npm run lint` for TypeScript changes. Run broader suites when a change crosses process boundaries or affects packaging, migrations, or security.
- Keep repository paths relative to its root in code, comments, docs, tests, and CI. Do not add machine-specific paths or identifiers.
- Add a code comment only when it explains a lasting constraint that the code cannot show. Keep existing comments unless the constraint has changed. Use JSDoc for important external APIs and helpers.
- Keep documentation filenames in kebab case. The public site lives under `doc/src/content/docs/`.
- Do not overwrite unrelated work in the working tree. Finish the requested change, check the diff, and report any checks you could not run.
