---
title: Dependency rules
description: The folder layers in src/ and the dependency-cruiser rules that keep them free of cycles.
sidebar:
  order: 11
---

Monfil keeps the import graph of `src/` free of cycles, between files and between folders. [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) checks the graph with the rules in `.dependency-cruiser.cjs`. `npm run lint` runs it, so the pre-commit hook and CI fail on a violation. Run only this check with:

```bash
npm run lint:deps
```

ESLint still enforces the boundaries between the main, preload, renderer, and shared trees. dependency-cruiser checks the folders inside each tree.

## Folder layers

Each rule names a folder and the folders that it may import. In the main process, the layers go from the bottom to the top:

| Folder | May import |
| --- | --- |
| `src/main/logging/` | Only itself |
| `src/main/lib/` | `logging` |
| `src/main/db/` | `lib` and `logging` |
| `src/main/app/`, `src/main/feed/`, `src/main/opml/`, `src/main/feedpacks/`, `src/main/updates/` | Lower layers and each other, without a cycle |
| `src/main/ipc/` | Every folder above |
| `src/main/` root | Everything. `main.ts` wires the app together, so no subfolder may import a file in the root. |

In the renderer, `lib` holds helpers without React context, `providers` share state, and `components` and `routes` build the views. A lower folder must not import a higher one.

When a feature folder must send an event to the renderer, it uses `src/main/lib/sendToRenderer.ts`, not a module in `ipc`.

## Fix a violation

The error names the rule and the import that breaks it. Each rule in `.dependency-cruiser.cjs` has a comment that tells where the shared code should go. Usually you move the shared code down to a folder that both sides can import.

The folder cycle rule does not see a cycle between a folder and its own subfolder. Two rules cover the two cases that exist in `src/`: `src/main/feed/sources/` must not import `src/main/feed/`, and the `src/renderer/lib/` root must not import `src/renderer/lib/river/`.

`dependency-cruiser.test.ts` writes small fixture trees and checks that each rule reports, or allows, the expected imports. Add a case there when you add or change a rule.
