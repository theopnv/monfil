# Monfil

RSS feed reader and more.

Monfil means "My feed" in french.

[![Publish](https://github.com/theopnv/monfil/actions/workflows/publish.yml/badge.svg)](https://github.com/theopnv/monfil/actions/workflows/publish.yml)

## Contributing

This is an Electron project based on [Vite](https://vite.dev):
- `src/main`: the backend
- `src/preload`: preload scripts
- `src/renderer`: a react project

### Back-end

See [doc/backend.md](doc/backend.md).

Dependencies:
- Database: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) as the driver and [Kysely](https://kysely.dev) for type support. See [doc/database.md](doc/database.md).

### Front-end

See [doc/frontend.md](doc/frontend.md).

Dependencies:
- CSS framework: [Untitled UI](https://www.untitledui.com/react). See [doc/untitled-ui.md](doc/untitled-ui.md) for this project's setup and conventions.
- [TanStack](https://tanstack.com) for routing.

### Debugging

#### vs-code

Use the `Main + Renderer` debugging configuration.

### Packaging

Run `npm run make` to exercise the electron-forge packaging command. It will output binaries in `out/<os>`.

### Testing

The projects uses different frameworks for each domain of the test pyramid:
- Unit tests: [vitest](https://vitest.dev). Test only one function. Mostly used for testing the backend.
- Integration tests: [vitest browser mode](https://vitest.dev/guide/browser/component-testing.html). Test react components inside the browser.
- End to End (E2E): [playwright](https://playwright.dev/). Test entire user stories.

Run `npm run test` to run all of them.

### Publishing

Push a tag matching `v*` (e.g. `v1.2.3`) to trigger the [publish workflow](.github/workflows/publish.yml). It builds on Linux, macOS and Windows, and creates a **draft** GitHub release with all platform artifacts attached.

Once the run finishes, review the draft release on GitHub (download and test the artifacts), then click **Edit → Publish release** to make it public. Nothing rebuilds at that point — publishing only flips the release's visibility.
