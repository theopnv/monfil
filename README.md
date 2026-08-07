# Monfil

RSS feed reader and more.

Monfil means "My feed" in french.

## Contributing

### Debugging

#### vs-code

Use the `Main + Renderer` debugging configuration.

### Packaging

Run `npm run make` to exercise the electron-forge packaging command. It will output binaries in `out/<os>`.

### Publishing

Push a tag matching `v*` (e.g. `v1.2.3`) to trigger the [publish workflow](.github/workflows/publish.yml). It builds on Linux, macOS and Windows, and creates a **draft** GitHub release with all platform artifacts attached.

Once the run finishes, review the draft release on GitHub (download and test the artifacts), then click **Edit → Publish release** to make it public. Nothing rebuilds at that point — publishing only flips the release's visibility.
