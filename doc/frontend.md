# Frontend

The renderer is a React 19 app. It uses TanStack Router, Tailwind CSS v4, and Untitled UI on top of React Aria Components.

## Routing

Add a route by adding a file to `src/renderer/routes/`. Nothing else needs to change.

The router uses hash history. Production serves the renderer over `file://`, where path-based routing cannot resolve a route against the filesystem path. This is why e2e tests navigate with `window.history.pushState(null, '', '#/settings')` instead of a URL push.

React Aria links need a bridge to the router. `RouteProvider` supplies it. Any subtree with Untitled UI links or buttons that navigate must sit below that provider.

## Providers and data

App-wide providers belong in the root route, `src/renderer/routes/__root.tsx`. Providers that only feed one part of the app belong in `AppShell`, wrapped around the part that reads them.

The renderer pulls data from main, rather than main pushing it. A provider calls `window.electron.ipcRenderer.invoke(...)` in a `useEffect` on mount and sets state from the response. Components read the result through a hook that throws when it is used outside its provider. `feeds-provider.tsx` is the model to copy.

This is deliberate: `webContents.send` (a main -> renderer push) has no buffering, so a message sent before the renderer's listener attaches is silently lost. Pulling with `invoke` on mount has no such ordering dependency — the response always reaches the caller that asked for it, regardless of timing.

Main pushes only what the renderer cannot ask for, because main decided it on its own. The refresh scheduler is the case today: it broadcasts the new list on `feeds:list`, the same channel the provider invokes on mount. A lost push is harmless there, since it can only be lost before the provider mounts, and the mount-time invoke then returns the refreshed list anyway. The reverse order is the one to watch: the mount-time invoke can answer with a snapshot taken before the refresh landed, so `FeedsProvider` drops that answer once a push has arrived.

"Renderer-only" data that needs to be stored between sessions should go to the localStorage, and not the database, to avoid the overload of setting up an extra channel between the renderer and main.

## Preferences

`preferences-provider.tsx` holds the renderer-only settings: density, hide-read-items, mark-read-on-scroll and open-links-externally. `src/renderer/lib/preferences.ts` reads and writes each one under its own `localStorage` key, defaulting and discarding a stored value that fails validation rather than trusting it blindly. `usePreferences()` returns `{ preferences, setPreference }`; call `setPreference(key, value)` to update one field, which writes through to `localStorage` and re-renders every consumer.

These preferences are `localStorage`-only because none of them are read by main: refresh interval and refresh-on-launch, by contrast, live in the `setting` table (`src/main/settings.ts`) since the refresh scheduler in main needs them. Read state (`feedItem.read_at`) lives in the database too, since it is data about a feed item rather than a client preference.

## Styling

`src/renderer/styles/globals.css` is the entry point. It imports Tailwind, then `theme.css`, then `monfil-theme.css`.

`theme.css` is vendored from Untitled UI. Do not edit it, because it is replaced when their theme is re-pulled. Put every palette change in `monfil-theme.css`, which loads after it and wins.

Use the semantic tokens (`bg-primary`, `text-brand-secondary`, `border-secondary`) rather than raw color values. They resolve for light mode and dark mode on their own.

Dark mode is a `dark-mode` class on `<html>`, set by `ThemeProvider` and declared as a custom variant in `globals.css`. The theme is read from `localStorage` and follows the system setting by default.

## Untitled UI

See [doc/untitled-ui.md](untitled-ui.md) for how to add a component, why the vendored folder has its own tsconfig, and the icon and naming conventions.
