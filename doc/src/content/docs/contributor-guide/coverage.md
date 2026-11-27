---
title: Code coverage
description: Run the coverage suites, open the reports, and read the coverage and test count history on the dashboard.
sidebar:
  order: 14
---

Monfil measures which lines of `src/` its tests run. Each pull request gets a report and a comment, and the history of `main` is in the same D1 database as the [complexity metrics](../complexity/), stored by [Devanalytics](https://github.com/theopnv/devanalytics). No threshold fails a build yet.

```text
PR ──> coverage.yml ──> coverage-comment.yml ──> sticky comment (compares with D1)
main ──> coverage.yml ──> devanalytics Action ──> Worker ──> D1 <── Grafana
```

## Run the suites

| Command | What it does |
| --- | --- |
| `npm run test:unit` | Runs the Node tests (the `node` Vitest project). |
| `npm run test:integration` | Runs the renderer tests in Chromium (the `browser` Vitest project). |
| `npm run coverage:vitest` | Runs both projects with coverage, and writes the report to `.vitest/coverage/`. |
| `COVERAGE=1 npm run test:e2e` | Packages an instrumented app, runs the Electron tests, and writes one file for each launch to `coverage/e2e/raw/`. |
| `npm run coverage:merge` | Merges both runs. Writes `coverage/merged/`, `coverage/snapshot.json` for the pull request comment, and `coverage/istanbul/vitest.json` and `coverage/istanbul/e2e.json` for the ingest. |

`vitest.config.mts` is the root config. Its `test.projects` list holds `vitest.node.config.mts` (the `node` project) and `vitest.browser.config.mts` (the `browser` project). A command that names a single file still works with `--config`, for example `npx vitest run --config=vitest.browser.config.mts path/to/file.test.tsx`.

On Windows PowerShell, set the variable first with `$env:COVERAGE = '1'`.

## What each suite measures

All suites use Istanbul, so the counts of different runs add up.

| Suite | Source | Limits |
| --- | --- | --- |
| `vitest` | The Node and browser Vitest projects. It lists every file under `src/`, so a file that no test loads counts as uncovered. | None. |
| `e2e` | An instrumented build of the main process, the article extraction utility process, and the renderer. | The preload script runs in an isolated world that the collection cannot reach, so the suite shows it as uncovered. A test that kills the app leaves no file for that launch. |
| `total` | Both suites, joined by the location of each statement, function, and branch. | It counts the preload script through its unit tests only. |

These files are not counted: test files, `*.d.ts`, `src/main/test/`, `src/renderer/components/untitled-ui/`, and `src/renderer/routeTree.gen.ts`. The list is `INCLUDE` and `EXCLUDE` in `scripts/coverage/vite-plugins.mts`, which the root Vitest config imports.

### How the e2e build collects coverage

`COVERAGE=1` adds two plugins to the main and renderer Vite configs through `coveragePlugins` in `scripts/coverage/vite-plugins.mts`. Without the variable, the list is empty and the build does not change.

- The instrumentation plugin runs Istanbul after every other transform, and passes the combined source map to it. It uses `istanbul-lib-instrument` directly. `vite-plugin-istanbul` skips a module with a query in its id, such as the router plugin's `?tsr-split=component`, and that would leave the route components without coverage.
- The dump plugin adds `scripts/coverage/dump.mts` to the entry of each main-config build. On the first `before-quit`, the app reads `window.__coverage__` from every window, adds its own, and writes the list to `$COVERAGE_DIR/<pid>-<uuid>.json` (default `coverage/e2e/raw`). Then it quits again. Playwright's `app.close()` calls `app.quit()`, so the specs need no change. The utility process writes its own file when it exits.

`coverage:merge` maps every entry back to its source file with `istanbul-lib-source-maps`, so a file that the router plugin splits into several modules is one file in the report. It prints how many e2e files it read.

## Count the tests

The same `Coverage` run counts the tests of each suite. Vitest and Playwright write their `json` reporter output to `coverage/tests/`, and `coverage:merge` adds a `tests` object to the snapshot for the pull request comment when it gets both files:

```bash
npm run coverage:merge -- --vitest-results coverage/tests/vitest.json --e2e-results coverage/tests/e2e.json
```

| Suite | Source |
| --- | --- |
| `unit` | The Vitest files outside `src/renderer/`, which the `node` project runs. |
| `integration` | The Vitest files under `src/renderer/`, which the `browser` project runs. |
| `e2e` | The Playwright run. A flaky test counts as passed, because it passed on a retry. |

Each suite has `files`, `tests`, `passed`, `failed`, and `skipped`. A skipped, todo, or pending test counts in `tests` and in `skipped`. The pull request comment shows these three suites.

The ingest job gives the same two files to the `test-results` input of the Action. Devanalytics does not split the Vitest file by project, so its `coverage_tests` table has two suites: `vitest` (the `unit` and `integration` counts together) and `e2e`.

## Open the reports

- Each `Coverage` run on GitHub uploads two artifacts. `vitest-report` is the Vitest HTML report with its Coverage view. The run prints a notice with a link to `https://viewer.vitest.dev/?url=…`. `coverage-report` is the merged HTML report. Download it from the run page and open `index.html`.
- On your machine, open the Vitest report with the preview server:

```bash
npx vite preview --outDir .vitest
```

- Open `coverage/merged/index.html` for the merged report.

## Store the history

The ingest job in `coverage.yml` runs the `coverage` metric of Devanalytics on the push to `main`. The Action reads `coverage/istanbul/vitest.json` and `coverage/istanbul/e2e.json`, which `coverage:merge` writes, and the two test reports. It adds the suite `total`, the union of both reports, and sends one snapshot to the Worker. The Worker keeps it in D1.

The tables store covered and total counts and never percents, so a sum over files or folders stays correct:

- `coverage_files` has one row for each commit, suite (`vitest`, `e2e`, or `total`), and file.
- `coverage_folder_summary` has one row for each commit, suite, and folder, with the sums and `file_count`. The root `.` holds every file, `src` includes `src/main`, which includes `src/main/feed`. Filter a query on one folder, or on the direct children of one folder. Never add up all the rows.
- `coverage_tests` has one row for each commit and test suite (`vitest` or `e2e`), with `files`, `tests`, `passed`, `failed`, and `skipped`. A check makes `tests` equal to the sum of the other three. The suites do not overlap, so the sum of the rows of one commit is its total.

The README badge reads `/v1/coverage/badge?folder=src` through `https://img.shields.io/endpoint?url=…`. The route is public, so it runs one fixed query. It validates `suite` (default `total`) and `folder` (default `.`) and binds them. The Worker and shields.io both cache the answer for an hour, so a new snapshot shows on the badge within about an hour.

Dates are stored in UTC. A coverage query is refused when it names the table of another metric or a `sqlite_` table.

To load old tags, run the backfill command of Devanalytics from a clone of it. A tag has no coverage report, so `--run` makes one in the worktree:

```bash
npm run backfill -- --metric coverage --repo ../monfil --tags \
  --run "npm ci && npm run coverage:vitest" --input "reports=vitest=.vitest/coverage/coverage-final.json"
```

This loads the `vitest` suite only, because the e2e run needs an instrumented build. The backfill stays inside the daily write limit of D1 and continues on the next day when it must.

## Pull request comment

The work is split over two workflows, like the complexity report:

- `coverage.yml` runs on `pull_request` with a read-only token. It runs the PR's code and uploads the snapshot and the PR number.
- `coverage-comment.yml` runs on `workflow_run` with `pull-requests: write`. It checks out only `scripts/coverage` and `scripts/devanalytics` from `main`, checks the PR number and head sha, and reads the base from D1 through `/v1/coverage/query`. The base is the row of the merge base. If that sha has no row, the comment compares with the latest earlier commit on `main` and says so. It lists the totals of each suite and the changed files under `src/` that lost merged line coverage. The Worker names the merged suite `total`, and a step renames it to `merged` for `scripts/coverage/report.mts`.

`workflow_run` workflows run from the default branch. A change to `coverage-comment.yml` takes effect only after it lands in `main`.

The ingest job in `coverage.yml` runs on pushes to `main` only, and it is the only job that has `DEVANALYTICS_INGEST_TOKEN`. Both jobs need the repository variable `DEVANALYTICS_URL`. The comment job needs the repository secret `DEVANALYTICS_QUERY_TOKEN`.

## Run the dashboard

The coverage dashboard reads `/v1/coverage/query` through the Infinity plugin. Import `metrics/coverage/dashboard.json` of Devanalytics, and follow its [Grafana guide](https://github.com/theopnv/devanalytics/blob/main/docs/setup-grafana.md). Set the `folder` variable to `src` for the folder that the old dashboard showed.
