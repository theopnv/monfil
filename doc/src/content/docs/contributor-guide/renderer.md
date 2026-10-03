---
title: Renderer
description: Routes, state, and UI conventions.
sidebar:
  order: 5
---

The [renderer](https://github.com/theopnv/monfil/tree/main/src/renderer) is a React app. It uses TanStack Router for routes, TanStack Query for data loaded from main, UntitledUI for components, and Tailwind CSS for styling.

## Find a route

`AppShell` holds the toolbar and route outlet. The [routes folder](https://github.com/theopnv/monfil/tree/main/src/renderer/routes) defines views. Hash history lets the packaged app load routes from a file. The root route installs app-wide providers, the startup gate, and the error boundary.

## Choose where state belongs

Use the preload bridge for work owned by main. The [channel contracts](https://github.com/theopnv/monfil/blob/main/src/shared/channels.ts) define its names and payloads. TanStack Query holds data such as river pages and the feedpack catalog. [Providers](https://github.com/theopnv/monfil/tree/main/src/renderer/providers) share UI state such as the active workspace, reading preferences, and search text. Check for an existing owner before you add another copy.

:::note[Events have no replay]
An IPC push can arrive before a listener attaches. Load initial data with `invoke`, then use pushes to update a mounted view. The [feed provider](https://github.com/theopnv/monfil/blob/main/src/renderer/providers/feeds-provider.tsx) shows this pattern.
:::

## Build a component

Project components live in the [components folder](https://github.com/theopnv/monfil/tree/main/src/renderer/components); vendored UntitledUI components have their own subtree. The `@/` alias points to the renderer root.

The [styles folder](https://github.com/theopnv/monfil/tree/main/src/renderer/styles) loads Tailwind and the themes. Put palette changes in the project theme, which loads after the vendored theme. Use semantic color classes for light and dark modes. `ThemeProvider` follows the system theme by default.

:::tip[React Aria collections]
A collection can cache a row by item identity. If the row reads external state, pass it through `dependencies`. For an editable row, check whether typeahead needs `disallowTypeAhead`. See the [river components](https://github.com/theopnv/monfil/tree/main/src/renderer/components) for an example.
:::
