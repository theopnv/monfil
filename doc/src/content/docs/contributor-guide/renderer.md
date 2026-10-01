---
title: Renderer
description: Routes, state, and UI conventions.
sidebar:
  order: 5
---

`src/renderer/` is a React app. Dependencies:

- [TanStack Router](https://tanstack.com/router/latest) for routing.
- [TanStack Query](https://tanstack.com/query/latest) for state.
- [UntitledUI](https://www.untitledui.com/) for components.
- [TailwindCSS](https://tailwindcss.com/) for styling.

## Routes

`AppShell` holds the toolbar and the route outlet.

The router reads files from `src/renderer/routes/`. It uses hash history so routes also work when Electron loads the packaged app from a file. `__root.tsx` installs the app-wide providers, the startup gate, and the error boundary.

## Data and state

Use the preload bridge for main-process work. The typed channel names and payloads live in `src/shared/channels.ts`. TanStack Query holds server-backed data such as river pages and the feedpack catalog. Providers hold state shared across UI areas, such as the active workspace, reading preferences, and search text. Look at the provider that owns a value before adding another copy of that state.

An IPC push can arrive before a renderer listener attaches. Load initial data with `invoke`; use a push to update a mounted view. `src/renderer/providers/feeds-provider.tsx` and `src/renderer/lib/ipc-bridge.ts` show the two paths.

## Components and styles

Project components live under `src/renderer/components/`. The `untitled-ui/` subtree holds vendored UI components. The `@/` alias points to `src/renderer/`; its declarations live in the renderer TypeScript and Vite configs and the vendored UI config.

`src/renderer/styles/globals.css` loads Tailwind and the theme files. Put project palette changes in `monfil-theme.css`, which loads after the vendored `theme.css`. Use semantic color classes so the same component works in light and dark modes. `ThemeProvider` applies the `dark-mode` class and follows the system theme by default.

React Aria collections can cache a rendered row by item identity. If a row reads state from outside its `items`, pass that state through the collection's `dependencies` prop. For an editable row, check whether the collection's typeahead handling needs `disallowTypeAhead`. `RiverSidebar` has an example.
