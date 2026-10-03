---
title: Contributor guide
description: Find the code, understand its boundaries, and make a change.
sidebar:
  order: 1
---

Monfil is an Electron app written in TypeScript. Start with [Getting started](../getting-started/) to run it and send a pull request.

## Find your part of the app

- [Repository map](../map/) shows where each part lives.
- [Main process](../main/) covers startup, feed work, network access, and window security.
- [Renderer](../renderer/) covers routes, state, and UI code.
- [Electron IPC API](../api/) describes calls across the process boundary.
- [Database](../database/) covers data ownership, migrations, backups, and recovery.
- [Feed sources](../feed-sources/) explains adapters and refresh.
- [Feedpacks and OPML](../feedpacks-and-opml/) follows feed lists into and out of the app.
- [Diagnostics](../diagnostics/) shows how to investigate errors.
- [Release procedure](../release-procedure/) records the maintainer's publish steps.

## Keep the guide current

Update documentation in the same pull request as the code it describes. Explain boundaries and reasons that a contributor needs to know. Clean up obsolete claims when you find them.

Edit a page in the [contributor guide](https://github.com/theopnv/monfil/tree/main/doc/src/content/docs/contributor-guide), preview it with `npm --prefix doc run dev`, then run `npm run lint:docs` and `npm --prefix doc run build`. The site is built and published after the change lands in `main`.
