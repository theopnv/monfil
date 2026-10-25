---
title: Mutation testing
description: Run Stryker on your change, read the survivors and the tests that add nothing, and publish a report to the Stryker dashboard.
sidebar:
  order: 13
---

[Code coverage](../coverage/) tells which lines a test runs. It does not tell if a test would fail when that line is wrong. Mutation testing checks that. [StrykerJS](https://stryker-mutator.io/docs/stryker-js/introduction/) makes many small changes to the source, one at a time: it turns `<` into `<=`, empties a block, or replaces a string. Each changed copy is a *mutant*. Stryker runs the tests that cover the mutant. If a test fails, the mutant is *killed*. If all tests pass, it *survived*, and the code has a behavior that no test checks.

Mutation testing runs on your machine. No CI job runs it, and no threshold fails a build.

## Run it

| Command | What it does |
| --- | --- |
| `npm run mutate` | Mutates the source files that differ from the merge base with `main`, including uncommitted and new files. |
| `npm run mutate -- src/main/feed` | Mutates the files under a path. A path can be a file, a folder, or a git pathspec. |
| `npm run mutate -- --base origin/main` | Compares with another ref. |
| `npm run mutate -- --suite unit` | Runs one suite only: `unit` or `integration`. |
| `npm run mutate -- --all` | Mutates all of `src/`. |
| `npm run mutate:worklist -- [<path>]` | Writes `.mutation/worklist.md` from the last reports. |
| `npm run mutate:upload -- [--version <name>]` | Sends the last reports to the Stryker dashboard. |

The type check needs `src/renderer/routeTree.gen.ts`, so run `npx vite build --config src/renderer/vite.config.mts` once after a fresh clone.

`npm run mutate` prints a score table, and writes an HTML and a JSON report to `.mutation/unit/` and `.mutation/integration/`. Open `mutation.html` in a browser to see each mutant in its source line.

Each source file goes to one suite, by path:

| Suite | Files | Tests | Time for each mutant |
| --- | --- | --- | --- |
| `unit` | `src/main/`, `src/preload/`, `src/shared/` | The `node` Vitest project, from `vitest.node.config.mts` | Well under a second. A full run of the suite, about 7,600 mutants, takes about 15 minutes on a 10-core machine. |
| `integration` | `src/renderer/` | The `browser` Vitest project in Chromium, from `vitest.browser.config.mts` | About 7 seconds. Run it on one folder at a time. A full run takes hours. |

Test files, `*.d.ts`, `src/renderer/components/untitled-ui/`, and `src/renderer/routeTree.gen.ts` are never mutated. The e2e suite does not take part: each mutant would need a new Electron package.

## Read the result

Each mutant ends with one status:

| Status | Meaning | What to do |
| --- | --- | --- |
| Killed | A test failed. | Nothing. |
| Timeout | The tests did not finish, for example after a loop condition changed. Counts as killed. | Nothing. |
| Survived | Every test that runs the line passed. | Add or change a test so that it fails on this mutant. |
| NoCoverage | No test runs the line. | Add a test, or check if [coverage](../coverage/) from the e2e suite is enough for this code. |
| CompileError | The TypeScript check refused the mutant, so no test ran. | Nothing. Not counted in the score. |
| RuntimeError | The mutant broke the test run itself. | Nothing. Not counted in the score. |
| Ignored | A rule in the config skipped it. | Nothing. Not counted in the score. |

The *score* is `(killed + timeout) / (killed + timeout + survived + no coverage)`. The *covered* score leaves out `NoCoverage`, and shows how strong the tests are on the code they run.

### The work list

`npm run mutate:worklist` turns the reports into `.mutation/worklist.md`. For each suite, it lists:

- Each file with undetected mutants, most first, with the line, the mutator, and the original and replacement text of each mutant.
- **Tests that kill no mutant.** The test runs mutated code, but no mutant makes it fail. Check what it asserts. A test that checks a rejection or an empty result can still guard a behavior that no mutant reaches.
- **Tests without a unique kill.** Each mutant that the test kills is also killed by another test. It is a candidate to merge or remove, if a new run without it keeps the same kills.

Pass a path to keep only the files under it. The test lists then count only the mutants of those files.

### Improve the tests

The repository skill `.ai/skills/test-quality/` gives an agent the steps to work on one path: measure, kill the survivors, cover the code that no test runs, review the tests that add nothing, and measure again. It never changes the behavior of the source code, and it removes a test only when a new run shows the same kills. For example, with Claude Code:

```bash
claude -p "Use the test-quality skill on src/main/feed/sources"
```

### Equivalent mutants

Some mutants do not change what the code does, so no test can kill them. For example, `a >= b ? a : b` and `a > b ? a : b` return the same value, because both sides give the same result when `a === b`. Suppress such a mutant on its line, and give the reason:

```ts
// Stryker disable next-line EqualityOperator: when a === b both branches return the same value
return a >= b ? a : b;
```

The ESLint rule `mutation/stryker-disable` refuses a suppression without a reason, a suppression of `all` mutators, and a range suppression that stays on for the rest of the file. Suppress a whole class of mutants in `scripts/mutation/config.mts` instead. The config already skips:

- Calls such as `logger.warn(...)`, through the `logger` ignorer in `scripts/mutation/ignore-logger.mts`. A log line is a diagnostic, not a behavior of the app.
- Static mutants (`ignoreStatic`), such as a change in a regular expression at the top of a module. A static mutant runs when the module loads, so it runs every test of the suite. They took half the time of a full run and changed the score by less than one point.

## Publish to the dashboard

The [Stryker dashboard](https://dashboard.stryker-mutator.io/repos/theopnv) shows a report for each version of the project `github.com/theopnv/monfil`. Each suite is a module of the version.

1. Sign in to the dashboard with GitHub, enable the repository, and copy its API key.
2. Add the key to `.env` at the repository root. Git ignores this file.

   ```bash
   STRYKER_DASHBOARD_API_KEY=<key>
   ```

3. Run `npm run mutate`, then send the reports. The version defaults to the current branch.

   ```bash
   npm run mutate:upload -- --version main
   ```

The dashboard is public for a public repository, and a report holds the full source of each mutated file.

## How the runs work

`scripts/mutation/run.mts` starts Stryker once for each suite with the options from `scripts/mutation/config.mts`:

- **Runner:** `@stryker-mutator/vitest-runner` with `coverageAnalysis: 'perTest'`, so a mutant runs only the tests that cover its line. `disableBail` runs all of them, so the report lists every test that kills a mutant. The work list needs that, and it did not make a run slower.
- **Type check:** `@stryker-mutator/typescript-checker` compiles the root `tsconfig.json` before any test runs, and marks a mutant that does not compile as `CompileError`. About 45% of the mutants of the `unit` suite end there.
- **Sandbox:** Stryker copies `src/`, `feedpacks/`, the configs, and `package.json` to `.stryker-tmp/`, and links `node_modules`. Nothing else is copied.

### The false survivor check

After each suite, `run.mts` reads the report. If a survivor ran none of the tests that cover it, the command fails, because the score cannot be correct. That happens when the test name filter of the runner matches no test, as in [stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210). Update the exact versions of the `@stryker-mutator/*` packages together.
