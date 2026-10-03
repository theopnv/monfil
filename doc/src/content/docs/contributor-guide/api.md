---
title: Electron IPC API
description: The typed boundary between renderer and main.
sidebar:
  order: 6
---

The [channel contracts](https://github.com/theopnv/monfil/blob/main/src/shared/channels.ts) define calls and their argument and return types. [Shared data types](https://github.com/theopnv/monfil/blob/main/src/shared/contracts.ts) describe the payloads. The renderer calls main through `window.electron.ipcRenderer`.

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
| `app:reveal-database-file` | `sendMessage` | Show the database file in the file manager. |
| `app:reveal-log-file` | `sendMessage` | Show the log file. |
| `app:reveal-database-backup` | `sendMessage` | Show the database backup. |
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
| `feeds:validate-feed-url` | `invoke` | Resolve and fetch a feed entered by the user. |
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
| `feeds:show-feed-context-menu` | `sendMessage` | Open a feed's native context menu. |
| `feeds:show-category-context-menu` | `sendMessage` | Open a category's native context menu. |
| `feeds:item-image-fetched` | `on` | Receive an image found after refresh. |
| `feeds:refreshed` | `on` | Receive a background refresh summary. |
| `feeds:delete-feed-requested` | `on` | Handle a delete action from the context menu. |
| `feeds:rename-category-requested` | `on` | Handle a rename action from the context menu. |
| `feeds:delete-category-requested` | `on` | Handle a delete action from the context menu. |

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

## `settings:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `settings:get-refresh-interval` | `invoke` | Get the scheduled refresh interval. |
| `settings:set-refresh-interval` | `invoke` | Set the scheduled refresh interval. |
| `settings:get-refresh-on-launch` | `invoke` | Get the launch refresh setting. |
| `settings:set-refresh-on-launch` | `invoke` | Set the launch refresh setting. |
| `settings:get-retention-days` | `invoke` | Get the item retention period. |
| `settings:set-retention-days` | `invoke` | Set the item retention period. |
| `settings:get-detailed-logging` | `invoke` | Get the detailed logging setting. |
| `settings:set-detailed-logging` | `invoke` | Set the detailed logging setting. |

## `workspaces:*`

| Channel | Call | Purpose |
| --- | --- | --- |
| `workspaces:list` | `invoke` | Get workspace summaries. |
| `workspaces:create` | `invoke` | Create a workspace. |
| `workspaces:update` | `invoke` | Change a workspace. |
| `workspaces:delete` | `invoke` | Delete a workspace. |
| `workspaces:reorder` | `invoke` | Set workspace order. |
| `workspaces:show-context-menu` | `sendMessage` | Open a workspace's native context menu. |
| `workspaces:edit-requested` | `on` | Handle an edit action from the context menu. |
| `workspaces:export-requested` | `on` | Handle an export action from the context menu. |
| `workspaces:delete-requested` | `on` | Handle a delete action from the context menu. |

## Handle errors

Expected failures use the shared [`Result` type](https://github.com/theopnv/monfil/blob/main/src/shared/result.ts). Callers handle tagged errors by `name`. An unexpected throw at the IPC boundary becomes an `UNEXPECTED_ERROR` with an incident ID.

## Add or change a channel

Define the arguments and result in the channel contracts. Keep shared data shapes in the shared contracts. Main registers calls and listeners in its [IPC folder](https://github.com/theopnv/monfil/tree/main/src/main/ipc). For an event to the renderer, use the typed send helpers and attach a listener with cleanup. Add a test at the boundary where behavior changes.
