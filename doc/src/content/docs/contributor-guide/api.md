---
title: Electron IPC API
description: The typed boundary between renderer and main.
sidebar:
  order: 6
---

The [invoke schema](https://github.com/theopnv/monfil/blob/main/src/shared/ipc-schema.ts) holds one entry per `invoke` channel: the guard that checks its argument, and its result type. The [channel contracts](https://github.com/theopnv/monfil/blob/main/src/shared/channels.ts) define the one-way channels. [Shared data types](https://github.com/theopnv/monfil/blob/main/src/shared/contracts.ts) describe the payloads. The renderer calls main through `window.electron.ipcRenderer`.

## Find a channel

The invoke schema and the channel contracts are the current channel list. This page does not repeat them.

A channel is called in one of three ways. `invoke` sends a request to main and returns a result. `sendMessage` sends a command without a result. `on` receives an event from main.

:::note[Events have no replay]
Load initial state, such as the feed list, with `invoke`. Use `on` for later updates while the view is mounted.
:::

## Handle errors

Expected failures use the shared [`Result` type](https://github.com/theopnv/monfil/blob/main/src/shared/result.ts). Callers handle tagged errors by `name`. An unexpected throw at the IPC boundary becomes an `UNEXPECTED_ERROR` with an incident ID.

## Add or change a channel

For an `invoke` channel, add one entry to the invoke schema and one entry to the [route table](https://github.com/theopnv/monfil/blob/main/src/main/ipc/routes.ts). A missing route does not compile. For a one-way channel, define the payload in the channel contracts and register a listener in the [IPC folder](https://github.com/theopnv/monfil/tree/main/src/main/ipc). Keep shared data shapes in the shared contracts. For an event to the renderer, use the typed send helpers and attach a listener with cleanup. Add a test at the boundary where behavior changes.
