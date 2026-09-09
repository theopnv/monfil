# Frontend

Dependencies:
- [React 19](https://react.dev/)
- [TanStack](https://tanstack.com) for routing
- [React Aria](https://react-aria.adobe.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- CSS framework: [Untitled UI](https://www.untitledui.com/react). See [doc/untitled-ui.md](./untitled-ui.md) for this project's setup and conventions.

## Routing

Add a route by adding a file to `src/renderer/routes/`.

The router uses hash history. Production serves the renderer over `file://`, where path-based routing cannot resolve a route against the filesystem path. This is why e2e tests navigate with `window.history.pushState(null, '', '#/settings')` instead of a URL push.

React Aria links need a bridge to the router. `RouteProvider` supplies it. Any subtree with Untitled UI links or buttons that navigate must sit below that provider.

## Providers and data

App-wide providers belong in the root route, `src/renderer/routes/__root.tsx`. Providers that only feed one part of the app belong in `AppShell`, wrapped around the part that reads them.

❌ Don't use `webContents.send` without a good reason to. A main -> renderer message sent before the renderer's listener attaches can silently get lost.

✅ Do use `window.electron.ipcRenderer.invoke(...)` in a `useEffect` hook and set state from the response. `feeds-provider.tsx` is the model to copy.

Some exceptions. Main pushes only what the renderer cannot ask for, because main decided it on its own:
- The refresh scheduler: it broadcasts the new list on `feeds:list`, the same channel the provider invokes on mount. A lost push is harmless there, since it can only be lost before the provider mounts, and the mount-time invoke then returns the refreshed list anyway.

## Styling

`src/renderer/styles/globals.css` is the entry point. It imports Tailwind, then `theme.css`, then `monfil-theme.css`.

`theme.css` is vendored from Untitled UI. Do not edit it, because it is replaced when their theme is re-pulled. Put every palette change in `monfil-theme.css`, which loads after it and wins.

Use the semantic tokens (`bg-primary`, `text-brand-secondary`, `border-secondary`) rather than raw color values. They resolve for light mode and dark mode on their own.

Dark mode is a `dark-mode` class on `<html>`, set by `ThemeProvider` and declared as a custom variant in `globals.css`. The theme is read from `localStorage` and follows the system setting by default.

## Untitled UI

See [doc/untitled-ui.md](untitled-ui.md) for how to add a component, why the vendored folder has its own tsconfig, and the icon and naming conventions.
