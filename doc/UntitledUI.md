# Untitled UI

React 19 + Tailwind CSS v4 + React Aria Components, wired up per the [Untitled UI Vite integration](https://www.untitledui.com/react/integrations/vite). This file documents that setup and the conventions to follow.

## Layout

Renderer code lives under `src/renderer/`, a sibling of `src/main/` and `src/preload/` (Electron's process split). The `@/` import alias points at `src/renderer/`, **not** the repo root — this differs from Untitled UI's default Vite template, which assumes a flat `src/`.

- `src/renderer/styles/globals.css` — imports Tailwind, `theme.css`, and the `tailwindcss-animate` / `tailwindcss-react-aria-components` plugins
- `src/renderer/styles/theme.css` — design tokens (`@theme` block): fonts, spacing, radius, shadows, brand color scale, light/dark variables
- `src/renderer/providers/theme-provider.tsx` — light/dark/system theme,  persisted to `localStorage`; toggles the `dark-mode` class (not Tailwind's default `dark`) on `<html>`
- `src/renderer/providers/route-provider.tsx` — bridges React Aria's `RouterProvider` to `react-router-dom`
- `src/renderer/hooks/` — `use-breakpoint.ts` (match a Tailwind breakpoint), `use-clipboard.ts`
- `src/renderer/utils/cx.ts` — `cx()` (Tailwind-aware class merging via `tailwind-merge`) and `sortCx()` (identity function, just for grouping style objects readably)
- `src/renderer/utils/is-react-component.ts` — runtime component-type checks

## Adding components

Components come from Untitled UI's CLI, not copy-paste:

```bash
npx untitledui@latest add <component>   # e.g. `add button`
npx untitledui@latest add               # interactive browse by category
```

Place generated output under `src/renderer/components/untitled-ui/{base,application,marketing,foundations}/` to match upstream's categorization, and point its imports at the `@/` alias and this project's `cx`/provider locations. `src/renderer/components/`
outside of `untitled-ui/` is for this project's own components (e.g. `ThemeToggle.tsx`) — keeping vendored code under one folder makes it obvious what's generated versus hand-written, and is what the scoped tsconfig below targets.

The CLI doesn't know about this project's `src/renderer/` nesting: `-p` doesn't land where you'd expect, and it writes fresh copies of shared deps (`utils/cx.ts`, `utils/is-react-component.ts`) to a plain `src/utils/` instead of reusing `src/renderer/utils/`. After running `add`, check `git status`, move the component into place by hand, and delete any duplicate utils it dropped outside `src/renderer/`.

## Conventions

- Files: kebab-case (`date-picker.tsx`, not `DatePicker.tsx`)
- Imports from `react-aria-components` get an `Aria` prefix to avoid clashing with local component names: `import { Button as AriaButton } from "react-aria-components"`
- `src/renderer/components/untitled-ui/tsconfig.json` scopes to just that folder and turns off `exactOptionalPropertyTypes` — Untitled UI's generated code assumes a plain strict template and routinely passes `undefined` to optional Aria props, which this project's stricter root config forbids. That config isn't wired into `npm run lint`'s `tsc` run (vendored files still get pulled in and checked strictly there via `App.tsx`'s import graph — TS can't give a file two different rule sets in one compilation), so a new component may still need a small manual patch to pass lint even though it's clean on its own. `npx tsc -p src/renderer/components/untitled-ui --noEmit` checks it in isolation.
- Icons: `import { Home01 } from "@untitledui/icons"`; pass as a component reference where possible (`iconLeading={ChevronDown}`); JSX usage needs `data-icon`
- Brand color: edit the `--color-brand-*` scale (25–950) in `theme.css`; semantic tokens (`text-brand-primary`, `bg-brand-solid`, ...) derive from it for both light and dark mode automatically
