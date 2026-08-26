# Welcome!

This is an Electron project based on [Vite](https://vite.dev):
- `src/main`: the backend
- `src/preload`: preload scripts
- `src/renderer`: a react project

## Table of Content

- [Storage](./storage.md)
- [Database](./database.md)
- [Backend](./backend.md)
  - [Sources](./sources.md)
- [Frontend](./frontend.md)
  - [Untitled UI](./untitled-ui.md)

## Debugging

Feel free to submit PRs for any missing debugging configurations.

### vs-code

Use the `Main + Renderer` debugging configuration.

## Packaging

Run `npm run make` to exercise the electron-forge packaging command. It will output binaries in `out/<os>`.

## Testing

The projects uses different frameworks for each domain of the test pyramid:
- Unit tests (`npm run test:unit`): [vitest](https://vitest.dev). Test only one function. Mostly used for testing the backend.
- Integration tests (`npm run test:integration`): [vitest browser mode](https://vitest.dev/guide/browser/component-testing.html). Test react components inside the browser.
- End to End (E2E) (`npm run test:e2e`): [playwright](https://playwright.dev/). Test entire user stories.

Run `npm run test` to run all of them.

## Publishing

Push a tag matching `v*` (e.g. `v1.2.3`) to trigger the [publish workflow](.github/workflows/publish.yml). It builds on Linux, macOS and Windows, and creates a **draft** GitHub release with all platform artifacts attached.

Once the run finishes, review the draft release on GitHub (download and test the artifacts), then click **Edit → Publish release** to make it public. Nothing rebuilds at that point — publishing only flips the release's visibility.
