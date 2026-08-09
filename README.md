# Monfil

RSS feed reader and more.

Monfil means "My feed" in french.

## Contributing

This is an Electron project based on [Vite](https://vite.dev):
- `src/main`: the backend
- `src/preload`: preload scripts
- `src/renderer`: a react project

### Front-end

Dependencies:
- CSS framework: [Untitled UI](https://www.untitledui.com/react). See [doc/UntitledUI.md](doc/UntitledUI.md) for this project's setup and conventions.
- [TanStack](https://tanstack.com) for routing.

### Debugging

#### vs-code

Use the `Main + Renderer` debugging configuration.

### Packaging

Run `npm run make` to exercise the electron-forge packaging command. It will output binaries in `out/<os>`.

### Testing

The projects uses [vitest](https://vitest.dev) for unit tests, and [playwright](https://playwright.dev/) for end-to-end (e2e) tests. Run `npm run test`.

### Publishing

Push a tag matching `v*` (e.g. `v1.2.3`) to trigger the [publish workflow](.github/workflows/publish.yml). It builds on Linux, macOS and Windows, and creates a **draft** GitHub release with all platform artifacts attached.

Once the run finishes, review the draft release on GitHub (download and test the artifacts), then click **Edit → Publish release** to make it public. Nothing rebuilds at that point — publishing only flips the release's visibility.
