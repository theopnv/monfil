---
title: Code coverage
description: Run the coverage suites, open the reports, and read the coverage and test count history on the dashboard.
sidebar:
  order: 12
---

Monfil measures which lines of `src/` its tests run. Each pull request gets a report and a comment, and the history of `main` is in the same D1 database as the [complexity metrics](../complexity/). No threshold fails a build yet.

```text
PR ──> coverage.yml ──> coverage-comment.yml ──> sticky comment (compares with D1)
main ──> coverage.yml ──> Worker /coverage/ingest ──> D1 <── Worker /coverage/query <── Grafana
```

## Run the suites

| Command | What it does |
| --- | --- |
| `npm run test:unit` | Runs the Node tests (the `node` Vitest project). |
| `npm run test:integration` | Runs the renderer tests in Chromium (the `browser` Vitest project). |
| `npm run coverage:vitest` | Runs both projects with coverage, and writes the report to `.vitest/`. |
| `COVERAGE=1 npm run test:e2e` | Packages an instrumented app, runs the Electron tests, and writes one file for each launch to `coverage/e2e/raw/`. |
| `npm run coverage:merge` | Merges both runs. Writes `coverage/merged/` and `coverage/snapshot.json`. |

`vitest.config.mts` is the root config. Its `test.projects` list holds the `node` project and `vitest.browser.config.mts`. A command that names a single file still works with `--config`, for example `npx vitest run --config=vitest.browser.config.mts path/to/file.test.tsx`.

On Windows PowerShell, set the variable first with `$env:COVERAGE = '1'`.

## What each suite measures

All suites use Istanbul, so the counts of different runs add up.

| Suite | Source | Limits |
| --- | --- | --- |
| `vitest` | The Node and browser Vitest projects. It lists every file under `src/`, so a file that no test loads counts as uncovered. | None. |
| `e2e` | An instrumented build of the main process, the article extraction utility process, and the renderer. | The preload script runs in an isolated world that the collection cannot reach, so the suite shows it as uncovered. A test that kills the app leaves no file for that launch. |
| `merged` | Both suites, joined by the location of each statement, function, and branch. | It counts the preload script through its unit tests only. |

These files are not counted: test files, `*.d.ts`, `src/renderer/components/untitled-ui/`, and `src/renderer/routeTree.gen.ts`. The list is in `scripts/coverage/vite-plugins.mts` and in the root Vitest config.

### How the e2e build collects coverage

`COVERAGE=1` adds two plugins to the main and renderer Vite configs through `coveragePlugins` in `scripts/coverage/vite-plugins.mts`. Without the variable, the list is empty and the build does not change.

- The instrumentation plugin runs Istanbul after every other transform, and passes the combined source map to it. It uses `istanbul-lib-instrument` directly. `vite-plugin-istanbul` skips a module with a query in its id, such as the router plugin's `?tsr-split=component`, and that would leave the route components without coverage.
- The dump plugin adds `scripts/coverage/dump.mts` to the entry of each main-config build. On the first `before-quit`, the app reads `window.__coverage__` from every window, adds its own, and writes the list to `$COVERAGE_DIR/<pid>-<uuid>.json` (default `coverage/e2e/raw`). Then it quits again. Playwright's `app.close()` calls `app.quit()`, so the specs need no change. The utility process writes its own file when it exits.

`coverage:merge` maps every entry back to its source file with `istanbul-lib-source-maps`, so a file that the router plugin splits into several modules is one file in the report. It prints how many e2e files it read.

## Count the tests

The same `Coverage` run counts the tests of each suite. Vitest and Playwright write their `json` reporter output to `coverage/tests/`, and `coverage:merge` adds a `tests` object to the snapshot when it gets both files:

```bash
npm run coverage:merge -- --vitest-results coverage/tests/vitest.json --e2e-results coverage/tests/e2e.json
```

| Suite | Source |
| --- | --- |
| `unit` | The Vitest files outside `src/renderer/`, which the `node` project runs. |
| `integration` | The Vitest files under `src/renderer/`, which the `browser` project runs. |
| `e2e` | The Playwright run. A flaky test counts as passed, because it passed on a retry. |

Each suite has `files`, `tests`, `passed`, `failed`, and `skipped`. A skipped, todo, or pending test counts in `tests` and in `skipped`. Without the two flags, the snapshot has no `tests` object and the ingest removes the counts of that sha.

## Open the reports

- Each `Coverage` run on GitHub uploads two artifacts. `vitest-report` is the Vitest HTML report with its Coverage view. The run prints a notice with a link to `https://viewer.vitest.dev/?url=…`. `coverage-report` is the merged HTML report. Download it from the run page and open `index.html`.
- On your machine, open the Vitest report with the preview server:

```bash
npx vite preview --outDir .vitest
```

- Open `coverage/merged/index.html` for the merged report.

## Backfill the tags

`coverage-backfill.yml` runs by hand from the Actions tab. Leave the input empty for every `v*` tag except `v0.0.1`, which has no tests, or list tags separated by spaces. Each tag is one job on `ubuntu-latest` that takes about 10 minutes, and four run at the same time. The final job uploads the snapshots one at a time, and only that job has the ingest token.

`scripts/coverage/backfill.mts` measures one tag with the current tooling:

1. It makes a worktree and runs `npm ci` there.
2. It installs `@vitest/coverage-istanbul` at the version that matches the tag's `vitest`, and `istanbul-lib-instrument`, without saving them.
3. It copies the plugins into the tag, and wraps the tag's main and renderer Vite configs with them. The configs come from the tag's `forge.config.ts`.
4. It runs the e2e suite, then the tag's Vitest configs one at a time with command-line coverage and reporter flags.
5. It runs the current `merge.mts` on the results, with the test counts.

A failing test does not stop a tag, because the coverage of the tests that ran is still valid. The script prints a warning. A suite that cannot start stops the tag.

To try it without the upload:

```bash
node scripts/coverage/backfill.mts --dry-run --out-dir /tmp/coverage-snapshots v0.5.1
```

Run the backfill again after a change to the excludes or to the instrumentation, or to fill the test counts of tags measured before they existed. Otherwise old rows and new rows were measured differently, and the trend shows a step that comes from the tool. One tag writes about 730 rows to D1, and the free plan allows 100,000 rows a day. Start a full backfill on a day with less than 75,000 rows already written.

## Store the history

The [devanalytics Worker](https://github.com/theopnv/monfil/tree/main/infra/devanalytics-worker) stores coverage in the same D1 database as the complexity metrics. It has two more endpoints:

| Endpoint | Token | What it does |
| --- | --- | --- |
| `POST /coverage/ingest` | `INGEST_TOKEN` | Replaces every row of the snapshot's sha in one transaction |
| `POST /coverage/query` | `QUERY_TOKEN` | Runs one `SELECT` or `WITH` statement on the coverage tables and returns at most 10,000 rows |

The tables store covered and total counts and never percents, so a sum over files or folders stays correct:

- `coverage_files` has one row for each commit, suite (`vitest`, `e2e`, or `merged`), and file.
- `coverage_folder_summary` has one row for each commit, suite, and folder, with the sums and `file_count`. `src` includes `src/main`, which includes `src/main/feed`. Filter a query on one folder, or on the direct children of one folder. Never add up all the rows.
- `coverage_tests` has one row for each commit and test suite (`unit`, `integration`, or `e2e`), with `files`, `tests`, `passed`, `failed`, and `skipped`. A check makes `tests` equal to the sum of the other three. The suites do not overlap, so the sum of the rows of one commit is its total.

Dates are stored in UTC. A coverage query is refused when it names a complexity table or a `sqlite_` table, and the reverse holds on the complexity route.

## Pull request comment

The work is split over two workflows, like the complexity report:

- `coverage.yml` runs on `pull_request` with a read-only token. It runs the PR's code and uploads the snapshot and the PR number.
- `coverage-comment.yml` runs on `workflow_run` with `pull-requests: write`. It checks out only `scripts/coverage` and `scripts/complexity` from `main`, checks the PR number and head sha, and reads the base from D1. The base is the row of the merge base. If that sha has no row, the comment compares with the latest earlier commit on `main` and says so. It lists the totals of each suite and the merged line coverage of the changed files under `src/`.

`workflow_run` workflows run from the default branch. A change to `coverage-comment.yml` takes effect only after it lands in `main`.

The ingest job in `coverage.yml` runs on pushes to `main` only, and it is the only job that has `DEVANALYTICS_INGEST_TOKEN`. The comment job needs the repository secret `DEVANALYTICS_QUERY_TOKEN`.

## Run the dashboard

Add an Infinity data source "Monfil Coverage" in Grafana Cloud, with the settings of the "Monfil Complexity" source described in [Code complexity](../complexity/#data-source): the Worker's `QUERY_TOKEN` as the Bearer token, and `https://monfil-devanalytics.tpenavaire.workers.dev` as the allowed host. Each panel uses the same request settings, with the URL `https://monfil-devanalytics.tpenavaire.workers.dev/coverage/query`.

A query variable named `folder` lists the folders of the latest commit:

```json
{"sql": "SELECT DISTINCT folder FROM coverage_folder_summary WHERE sha = (SELECT sha FROM coverage_folder_summary WHERE folder = 'src' AND suite = 'merged' ORDER BY date DESC LIMIT 1) ORDER BY folder"}
```

Every panel query starts with the `f(folder)` expression, which uses `src` when the parameter is empty or starts with `$`. A public dashboard does not support template variables and sends `$folder` unchanged, so without it the panel shows "No data".

**Trend** (time series): the line coverage of the folder for each suite, in percent.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END) SELECT s.date, 100.0 * sum(CASE WHEN s.suite = 'merged' THEN s.lines_covered END) / sum(CASE WHEN s.suite = 'merged' THEN s.lines_total END) AS merged, 100.0 * sum(CASE WHEN s.suite = 'vitest' THEN s.lines_covered END) / sum(CASE WHEN s.suite = 'vitest' THEN s.lines_total END) AS vitest, 100.0 * sum(CASE WHEN s.suite = 'e2e' THEN s.lines_covered END) / sum(CASE WHEN s.suite = 'e2e' THEN s.lines_total END) AS e2e FROM coverage_folder_summary s, f WHERE s.folder = f.folder GROUP BY s.date ORDER BY s.date","params":["$folder"]}
```

**Folder breakdown** (bar chart, X axis `child`): the direct children of the folder for the latest commit, merged suite.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END), latest(sha) AS (SELECT sha FROM coverage_folder_summary WHERE folder = (SELECT folder FROM f) AND suite = 'merged' ORDER BY date DESC LIMIT 1) SELECT substr(s.folder, length(f.folder) + 2) AS child, 100.0 * s.lines_covered / s.lines_total AS lines_pct, 100.0 * s.branches_covered / s.branches_total AS branches_pct, s.lines_total - s.lines_covered AS uncovered_lines, s.file_count FROM coverage_folder_summary s, f WHERE s.sha = (SELECT sha FROM latest) AND s.suite = 'merged' AND s.folder GLOB f.folder || '/*' AND s.folder NOT GLOB f.folder || '/*/*' ORDER BY uncovered_lines DESC","params":["$folder"]}
```

**Least covered files** (table): the 20 files with the lowest line coverage under the folder, for the latest commit, merged suite. Files with fewer than 20 lines are left out.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END), latest(sha) AS (SELECT sha FROM coverage_folder_summary WHERE folder = (SELECT folder FROM f) AND suite = 'merged' ORDER BY date DESC LIMIT 1) SELECT c.file, 100.0 * c.lines_covered / c.lines_total AS lines_pct, c.lines_total - c.lines_covered AS uncovered_lines FROM coverage_files c, f WHERE c.sha = (SELECT sha FROM latest) AND c.suite = 'merged' AND c.lines_total >= 20 AND c.file GLOB f.folder || '/*' ORDER BY lines_pct, uncovered_lines DESC LIMIT 20","params":["$folder"]}
```

**Suites** (bar gauge or stat): the line coverage of each suite for the latest commit.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END), latest(sha) AS (SELECT sha FROM coverage_folder_summary WHERE folder = (SELECT folder FROM f) AND suite = 'merged' ORDER BY date DESC LIMIT 1) SELECT s.suite, 100.0 * s.lines_covered / s.lines_total AS lines_pct, 100.0 * s.branches_covered / s.branches_total AS branches_pct FROM coverage_folder_summary s, f WHERE s.sha = (SELECT sha FROM latest) AND s.folder = f.folder","params":["$folder"]}
```

**Test count trend** (time series): the total number of tests and the number in each suite, for each commit. These panels do not use the `folder` variable.

```json
{"sql":"SELECT date, sum(tests) AS total, sum(CASE WHEN suite = 'unit' THEN tests END) AS unit, sum(CASE WHEN suite = 'integration' THEN tests END) AS integration, sum(CASE WHEN suite = 'e2e' THEN tests END) AS e2e FROM coverage_tests GROUP BY sha, date ORDER BY date"}
```

**Tests** (stat or table): the counts of each suite and the total, for the latest commit.

```json
{"sql":"WITH latest(sha) AS (SELECT sha FROM coverage_tests ORDER BY date DESC LIMIT 1) SELECT suite, tests, files, skipped FROM coverage_tests WHERE sha = (SELECT sha FROM latest) UNION ALL SELECT 'total', sum(tests), sum(files), sum(skipped) FROM coverage_tests WHERE sha = (SELECT sha FROM latest)"}
```

Declare the `date` column as **Timestamp**, and keep a fixed time range on the dashboard, for the same reasons as in [Code complexity](../complexity/#panels).
