---
title: Contributor guide
description: Find the code, understand its boundaries, and make a change.
sidebar:
  order: 1
---

Monfil is an [Electron](https://www.electronjs.org/docs/latest/) app written in Typescript.

Start with [Getting started](../getting-started/). It takes you from a local checkout to a pull request.

The rest of this guide follows the code you will change:

- [Repository map](../map/) shows where each part of the app lives.
- [Main process](../main/) covers startup, feed work, network access, and window security.
- [Renderer](../renderer/) covers routes, state, and UI code.
- [Electron IPC API](../api/) shows how the renderer talks to the main process.
- [Database](../database/) covers data ownership, migrations, backups, and recovery.
- [Feed sources](../feed-sources/) explains the adapter interface and refresh path.
- [Feedpacks and OPML](../feedpacks-and-opml/) explains how feed lists enter and leave the app.
- [Diagnostics](../diagnostics/) shows where errors go and how to investigate them.
- [Release procedure](../release-procedure/) records the maintainer's publish steps.

## Keep the guide current

Following [doc-as-code](https://www.writethedocs.org/guide/docs-as-code/) principles, documentation changes belong in the same pull request as the code they describe. Write about boundaries, interfaces, and reasons a contributor needs to know.

Leave the docs in a better shape than when you found them, don't hesitate to clean up obsolete claims!

To update the docs:

1. Edit a page in `doc/src/content/docs/contributor-guide/`. Run `npm run dev` in the `doc` folder to launch the Astro Starlight server.
2. Run `npm run lint:docs` and create a Pull Request.
3. Documentation is automatically built and published after landing in `main`.
