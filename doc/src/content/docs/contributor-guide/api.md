---
title: Electron IPC API
description: The typed boundary between renderer and main.
sidebar:
  order: 6
---

The [invoke schema](https://github.com/theopnv/monfil/blob/main/src/shared/ipc-schema.ts) holds one entry per `invoke` channel: the guard that checks its argument, and its result type. The [channel contracts](https://github.com/theopnv/monfil/blob/main/src/shared/channels.ts) define the one-way channels. [Shared data types](https://github.com/theopnv/monfil/blob/main/src/shared/contracts.ts) describe the payloads. The renderer calls main through `window.electron.ipcRenderer`.

## Read the channel list

The call column uses three terms. `invoke` sends a request to main and returns a result. `sendMessage` sends a command without a result. `on` receives an event from main.

:::note[Events have no replay]
Load initial state, such as the feed list, with `invoke`. Use `on` for later updates while the view is mounted.
:::

## `app:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `app:back-up-database` | `invoke` | Open the manual database backup dialog. |
| `app:get-info` | `invoke` | Get app details. |
| `app:get-startup-health` | `invoke` | Get database startup status. |
| `app:reveal` | `sendMessage` | Show the database file, the log file, or the database backup in the file manager. |
| `app:restart` | `sendMessage` | Restart the app. |
| `app:set-window-theme` | `sendMessage` | Match the window chrome to the selected theme. |

## `feedpacks:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `feedpacks:list` | `invoke` | Get the catalog. |
| `feedpacks:preview` | `invoke` | Read the sources in one pack. |
| `feedpacks:install` | `invoke` | Start a pack install in a workspace. |
| `feedpacks:install-finished` | `on` | Report the background refresh after install. |

## `feeds:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `feeds:discover` | `invoke` | Resolve and fetch a feed entered by the user. |
| `feeds:list-categories` | `invoke` | Get categories in a workspace. |
| `feeds:list` | `invoke` | Get feeds in a workspace. |
| `feeds:refresh` | `invoke` | Refresh feeds now. |
| `feeds:submit-add-feed` | `invoke` | Save a validated feed. |
| `feeds:delete-feed` | `invoke` | Remove a feed from a workspace. |
| `feeds:set-show-in-workspace` | `invoke` | Set feed visibility in a workspace. |
| `feeds:create-category` | `invoke` | Add a category. |
| `feeds:rename-category` | `invoke` | Rename a category. |
| `feeds:delete-category` | `invoke` | Delete a category and reassign its feeds. |
| `feeds:move-feeds-to-category` | `invoke` | Move feeds to a category. |
| `feeds:move-to-workspace` | `invoke` | Move a feed between workspaces. |
| `feeds:item-image-fetched` | `on` | Receive an image found after refresh. |
| `feeds:refreshed` | `on` | Receive a background refresh summary. |

## `items:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `items:query` | `invoke` | Get a page of river items. |
| `items:set-read` | `invoke` | Change item read state. |
| `items:get-content` | `invoke` | Get the body of a reader item. |

## `link:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `link:open` | `sendMessage` | Open an external link in the system browser. |

## `log:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `log:write` | `sendMessage` | Send a renderer log event to main. |

## `opml:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `opml:import` | `invoke` | Import feeds from an OPML file. |
| `opml:export` | `invoke` | Export one workspace as OPML. |

## `menu:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `menu:show` | `sendMessage` | Open the native context menu of a feed, category, or workspace. |
| `menu:action` | `on` | Receive the action the user picked in that menu. |

## `settings:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `settings:get` | `invoke` | Read one setting by key: refresh interval, refresh on launch, retention days, detailed logging, workspace rail, language, or usage stats consent. |
| `settings:set` | `invoke` | Write one setting by key and return its new state. |

## `workspaces:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `workspaces:list` | `invoke` | Get workspace summaries. |
| `workspaces:create` | `invoke` | Create a workspace. |
| `workspaces:update` | `invoke` | Change a workspace. |
| `workspaces:delete` | `invoke` | Delete a workspace. |
| `workspaces:reorder` | `invoke` | Set workspace order. |

## Handle errors

Expected failures use the shared [`Result` type](https://github.com/theopnv/monfil/blob/main/src/shared/result.ts). Callers handle tagged errors by `name`. An unexpected throw at the IPC boundary becomes an `UNEXPECTED_ERROR` with an incident ID.

## Add or change a channel

For an `invoke` channel, add one entry to the invoke schema and one entry to the [route table](https://github.com/theopnv/monfil/blob/main/src/main/ipc/routes.ts). A missing route does not compile. For a one-way channel, define the payload in the channel contracts and register a listener in the [IPC folder](https://github.com/theopnv/monfil/tree/main/src/main/ipc). Keep shared data shapes in the shared contracts. For an event to the renderer, use the typed send helpers and attach a listener with cleanup. Add a test at the boundary where behavior changes.
