# Devanalytics Worker

A Cloudflare Worker that stores development metrics in D1: the complexity snapshots from `scripts/complexity/`, the coverage snapshots from `scripts/coverage/`, and the CI runs from `scripts/ci/`. The contributor guide page [Code complexity](../../doc/src/content/docs/contributor-guide/complexity.md) explains the whole setup, from the lint limits to the Grafana dashboard.

## Complexity

- `POST /complexity/ingest` takes a snapshot from `npm run complexity` and replaces every row of its sha in one batch. It needs `Authorization: Bearer <INGEST_TOKEN>`.
- `POST /complexity/query` takes `{ "sql": "SELECT …", "params": [] }`, runs one `SELECT` or `WITH` statement on the complexity tables, and returns at most 10,000 rows with D1's `meta`. It needs `Authorization: Bearer <QUERY_TOKEN>`.

Tables:

- `complexity_functions`: one row for each function in each commit. The primary key starts with `sha`.
- `complexity_folder_summary`: one row for each folder in the subtree of each file, for each commit and test flag. `src` includes `src/main`, so filter on one folder and never add up all rows. Use it for trend panels: one commit reads one row, and the same trend on `complexity_functions` reads every function.

To filter `complexity_functions` by folder, use `file GLOB 'src/main/*'`. D1 limits a `LIKE` or `GLOB` pattern to 50 bytes.

A query route refuses SQL that names a table of another domain, or any `sqlite_` name. The old `/ingest` and `/query` routes return 404.

## Coverage

- `POST /coverage/ingest` takes a snapshot from `npm run coverage:merge` and replaces every row of its sha in one batch. It needs `Authorization: Bearer <INGEST_TOKEN>`.
- `POST /coverage/query` works like `/complexity/query`, on the coverage tables. It needs `Authorization: Bearer <QUERY_TOKEN>`.
- `GET /coverage/badge` needs no token. It returns the [shields.io endpoint](https://shields.io/badges/endpoint-badge) JSON for the line coverage of `src` in the newest `merged` snapshot, with `cacheSeconds: 3600` for shields.io and `Cache-Control: public, max-age=3600`. It runs one fixed query and reads nothing from the request. The badge is red below 60%, orange below 80%, and green from 80%, like the Stryker mutation score badge. Without a snapshot it says `unknown`.

Tables:

- `coverage_files`: one row for each source file, suite (`vitest`, `e2e` or `merged`) and commit, with covered and total counts for lines, statements, functions and branches.
- `coverage_folder_summary`: the same sums for each folder in the subtree of each file, with `file_count`. `src` includes `src/main`, so filter on one folder and never add up all rows.
- `coverage_tests`: one row for each test suite (`unit`, `integration` or `e2e`) and commit, with the counts of test files, tests, and passed, failed and skipped tests. It comes from the optional `tests` object of the snapshot. A snapshot without it removes the rows of its sha.

The tables store counts and never percents, so a sum of counts gives a correct percent. One ingest writes about 730 rows, and a second ingest of the same sha writes about twice that, because deletes count as writes.

## CI

- `POST /ci/ingest` takes a snapshot from `scripts/ci/collect.mts` and replaces every row of its run attempt in one batch. It needs `Authorization: Bearer <INGEST_TOKEN>`.
- `POST /ci/query` works like `/complexity/query`, on the CI tables. It needs `Authorization: Bearer <QUERY_TOKEN>`.

Tables, with one set of rows for each attempt of a `Test` or `Publish` workflow run:

- `ci_runs`: one row for each run attempt, with the event, the branch, the conclusion, `full_matrix`, `code_changed` and the wall time in seconds. `code_changed` is 0 when no test suite uploaded a report, as in a documentation-only pull request.
- `ci_jobs`: one row for each job, with the runner label, the operating system, the queue time and the run time.
- `ci_steps`: one row for each step of each job. GitHub times a step to the second, and a skipped step has no duration.
- `ci_step_groups`: one row for each `##[group]` of a job log that lasts a second or longer. It splits a composite action such as the setup action, and `actions/checkout`, into their own steps.
- `ci_test_suites`: one row for each suite (`unit`, `integration` or `e2e`) and runner, with the counts of tests, passed, failed, skipped and flaky tests. A flaky test passed on a retry, so `flaky` is part of `passed`.
- `ci_test_exceptions`: one row for each test that failed or needed a retry. A healthy run writes none.

A run writes about 250 rows, and a second ingest of the same attempt writes about twice that. SQLite has no percentile function, so a panel picks the row at the nearest rank with `ROW_NUMBER()` and `COUNT(*)` window functions.

## Grafana dashboards

The dashboards are in Grafana Cloud, which has no D1 data source, so they call the query routes of this Worker.

### Complexity dashboard

The [Infinity](https://grafana.com/docs/plugins/yesoreyeram-infinity-datasource/latest/) plugin calls the Worker's `/complexity/query` endpoint. The SQL is text in the request body, and Infinity reads the JSON response.

#### Data source

Set up the Infinity data source "Monfil Complexity":

- **Authentication:** Bearer token, with the Worker's `QUERY_TOKEN`. Never use the ingest token.
- **Allowed hosts:** `https://monfil-devanalytics.tpenavaire.workers.dev`.
- **Cache:** enable it and set the query TTL to `3600000` (1 hour). New data arrives only when a PR merges, and the cache keeps D1 reads low for public views.

Each panel and the variable use the same request:

- **Type:** JSON, **Source:** URL, **Method:** POST
- **URL:** `https://monfil-devanalytics.tpenavaire.workers.dev/complexity/query`
- **Body type:** Raw, **Body content type:** JSON
- **Rows/Root:** `rows`. The Worker returns `{ rows, truncated, meta }`.

Declare the columns with their types. A `date` column must be **Timestamp**, or a time series panel shows no data.

#### Folder variable

A query variable named `folder` lists every folder of the latest commit:

```json
{"sql": "SELECT DISTINCT folder FROM complexity_folder_summary WHERE sha = (SELECT sha FROM complexity_folder_summary WHERE folder = 'src' ORDER BY date DESC LIMIT 1) ORDER BY folder"}
```

Panels pass it as a bound parameter, `"params": ["$folder"]`, and never inside the SQL text. The saved dashboard keeps `src` as its value.

A public dashboard does not support template variables, so it sends the text `$folder` unchanged. Each panel query starts with an `f(folder)` expression that uses `src` when the parameter is empty or starts with `$`. Folder names never start with `$`. Without it, the public dashboard shows "No data".

#### Panels

**Trend** (time series): the sums for the folder over time.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END) SELECT s.date, s.cognitive_sum, s.cyclomatic_sum FROM complexity_folder_summary s, f WHERE s.folder = f.folder AND s.is_test = 0 ORDER BY s.date","params":["$folder"]}
```

**Folder breakdown** (bar chart, X axis `child`): the direct children of the folder for the latest commit.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END), latest(sha) AS (SELECT sha FROM complexity_folder_summary WHERE folder = (SELECT folder FROM f) ORDER BY date DESC LIMIT 1) SELECT substr(s.folder, length(f.folder) + 2) AS child, s.cognitive_sum, s.cyclomatic_sum, s.function_count, s.above_limits FROM complexity_folder_summary s, f WHERE s.sha = (SELECT sha FROM latest) AND s.is_test = 0 AND s.folder GLOB f.folder || '/*' AND s.folder NOT GLOB f.folder || '/*/*' ORDER BY s.cognitive_sum DESC","params":["$folder"]}
```

**Top functions** (table): the 20 most complex functions under the folder for the latest commit.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END), latest(sha) AS (SELECT sha FROM complexity_folder_summary WHERE folder = (SELECT folder FROM f) ORDER BY date DESC LIMIT 1) SELECT fn.qualified_name, fn.file, fn.line, fn.cognitive, fn.cyclomatic FROM complexity_functions fn, f WHERE fn.sha = (SELECT sha FROM latest) AND fn.is_test = 0 AND fn.file GLOB f.folder || '/*' ORDER BY fn.cognitive DESC, fn.cyclomatic DESC LIMIT 20","params":["$folder"]}
```

A data link on the `file` column opens the function on GitHub: `https://github.com/theopnv/monfil/blob/main/${__value.raw}#L${__data.fields.line}`. This panel reads the most rows, about 4,700 for `src`.

**Debt over time** (time series, step after): the functions above the limits. This line must go down over time.

```json
{"sql":"WITH f(folder) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'src' ELSE ?1 END) SELECT s.date, s.above_limits, s.cognitive_above, s.cyclomatic_above FROM complexity_folder_summary s, f WHERE s.folder = f.folder AND s.is_test = 0 ORDER BY s.date","params":["$folder"]}
```

`above_limits` counts a function above both limits once, so it can be less than the sum of the other two columns.

Keep a fixed time range on the dashboard. Grafana's cache key includes the time range, and a relative range such as "Last 1 year" changes on each load, so most views would miss the cache.

### Coverage dashboard

Add an Infinity data source "Monfil Coverage" in Grafana Cloud, with the settings of the "Monfil Complexity" source described in [Data source](#data-source): the Worker's `QUERY_TOKEN` as the Bearer token, and `https://monfil-devanalytics.tpenavaire.workers.dev` as the allowed host. Each panel uses the same request settings, with the URL `https://monfil-devanalytics.tpenavaire.workers.dev/coverage/query`.

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

Declare the `date` column as **Timestamp**, and keep a fixed time range on the dashboard, for the same reasons as in the [complexity panels](#panels).

### CI dashboard

The dashboard has two sections. "Codebase Health" holds the complexity and coverage panels, and "CI Health" holds the panels below. They use the Infinity data source of the other panels, which sends the Worker's `QUERY_TOKEN` as the Bearer token (see [Data source](#data-source)). Each CI panel posts to `https://monfil-devanalytics.tpenavaire.workers.dev/ci/query`.

SQLite has no percentile function. Each percentile panel numbers the rows of its group with `ROW_NUMBER()` and takes the first row whose number reaches the share of the group size, which is the nearest-rank method. A week with a few runs shows a p95 close to its maximum. Each panel buckets the data by the Monday of the week.

Percentile panels use runs of the `Test` workflow with `conclusion = 'success'` and `code_changed = 1`. Times are in seconds. Declare the `date` column as **Timestamp**, and keep a fixed time range on the dashboard, for the same reasons as in [complexity panels](#panels).

**Run time percentiles** (time series): the wall time of a run, with p50, p90 and p95 for each week. The parameter is `full_matrix`. Use `[0]` for the usual run, which has Linux jobs only. Make a copy of the panel with `[1]` for the runs of the `full-ci` label and for releases.

```json
{"sql":"WITH base AS (SELECT date(substr(date, 1, 10), 'weekday 0', '-6 days') AS week, wall_seconds AS v FROM ci_runs WHERE workflow = 'Test' AND conclusion = 'success' AND code_changed = 1 AND full_matrix = ?1), ranked AS (SELECT week, v, ROW_NUMBER() OVER (PARTITION BY week ORDER BY v) AS n, COUNT(*) OVER (PARTITION BY week) AS total FROM base) SELECT week AS date, MIN(CASE WHEN n >= 0.5 * total THEN v END) AS p50, MIN(CASE WHEN n >= 0.9 * total THEN v END) AS p90, MIN(CASE WHEN n >= 0.95 * total THEN v END) AS p95, MAX(total) AS runs FROM ranked GROUP BY week ORDER BY week","params":[0]}
```

**Job time percentiles** (table): p50, p90 and p95 of the run time of each job on each operating system.

```json
{"sql":"WITH base AS (SELECT replace(CASE WHEN instr(j.name, ' (') > 0 THEN substr(j.name, 1, instr(j.name, ' (') - 1) ELSE j.name END, 'test / ', '') AS job, j.os, j.duration_seconds AS v FROM ci_jobs j JOIN ci_runs r ON r.run_id = j.run_id AND r.run_attempt = j.run_attempt WHERE r.workflow = 'Test' AND r.conclusion = 'success' AND r.code_changed = 1 AND j.conclusion = 'success' AND j.duration_seconds IS NOT NULL), ranked AS (SELECT job, os, v, ROW_NUMBER() OVER (PARTITION BY job, os ORDER BY v) AS n, COUNT(*) OVER (PARTITION BY job, os) AS total FROM base) SELECT job, os, MAX(total) AS runs, MIN(CASE WHEN n >= 0.5 * total THEN v END) AS p50, MIN(CASE WHEN n >= 0.9 * total THEN v END) AS p90, MIN(CASE WHEN n >= 0.95 * total THEN v END) AS p95 FROM ranked GROUP BY job, os ORDER BY p50 DESC"}
```

**Queue time p95** (time series): the p95 of the wait for a runner, for each week and operating system.

```json
{"sql":"WITH base AS (SELECT date(substr(j.date, 1, 10), 'weekday 0', '-6 days') AS week, j.os, j.queue_seconds AS v FROM ci_jobs j JOIN ci_runs r ON r.run_id = j.run_id AND r.run_attempt = j.run_attempt WHERE r.workflow = 'Test' AND r.conclusion = 'success' AND r.code_changed = 1 AND j.conclusion = 'success' AND j.queue_seconds IS NOT NULL), ranked AS (SELECT week, os, v, ROW_NUMBER() OVER (PARTITION BY week, os ORDER BY v) AS n, COUNT(*) OVER (PARTITION BY week, os) AS total FROM base) SELECT week AS date, MIN(CASE WHEN os = 'linux' AND n >= 0.95 * total THEN v END) AS linux, MIN(CASE WHEN os = 'macos' AND n >= 0.95 * total THEN v END) AS macos, MIN(CASE WHEN os = 'windows' AND n >= 0.95 * total THEN v END) AS windows FROM ranked GROUP BY week ORDER BY week"}
```

**Slowest steps** (table): the average seconds that each step takes in a run of its job, and the slowest run. A step shorter than a second counts as 0.

```json
{"sql":"WITH job_runs AS (SELECT replace(CASE WHEN instr(j.name, ' (') > 0 THEN substr(j.name, 1, instr(j.name, ' (') - 1) ELSE j.name END, 'test / ', '') AS job, j.os, count(*) AS runs FROM ci_jobs j JOIN ci_runs r ON r.run_id = j.run_id AND r.run_attempt = j.run_attempt WHERE r.workflow = 'Test' AND r.conclusion = 'success' AND r.code_changed = 1 AND j.conclusion = 'success' GROUP BY 1, 2), spent AS (SELECT replace(CASE WHEN instr(j.name, ' (') > 0 THEN substr(j.name, 1, instr(j.name, ' (') - 1) ELSE j.name END, 'test / ', '') AS job, j.os, s.name, sum(s.duration_seconds) AS total, max(s.duration_seconds) AS slowest FROM ci_steps s JOIN ci_jobs j ON j.run_id = s.run_id AND j.run_attempt = s.run_attempt AND j.job_id = s.job_id JOIN ci_runs r ON r.run_id = s.run_id AND r.run_attempt = s.run_attempt WHERE r.workflow = 'Test' AND r.conclusion = 'success' AND r.code_changed = 1 AND j.conclusion = 'success' AND s.duration_seconds IS NOT NULL GROUP BY 1, 2, 3) SELECT s.job, s.os, s.name, round(1.0 * s.total / n.runs, 1) AS avg_seconds, s.slowest AS slowest_seconds FROM spent s JOIN job_runs n ON n.job = s.job AND n.os = s.os ORDER BY avg_seconds DESC LIMIT 40"}
```

**Slowest log groups** (table): the same for the log groups, which split the setup action and the checkout.

```json
{"sql":"WITH job_runs AS (SELECT replace(CASE WHEN instr(j.name, ' (') > 0 THEN substr(j.name, 1, instr(j.name, ' (') - 1) ELSE j.name END, 'test / ', '') AS job, j.os, count(*) AS runs FROM ci_jobs j JOIN ci_runs r ON r.run_id = j.run_id AND r.run_attempt = j.run_attempt WHERE r.workflow = 'Test' AND r.conclusion = 'success' AND r.code_changed = 1 AND j.conclusion = 'success' GROUP BY 1, 2), spent AS (SELECT replace(CASE WHEN instr(j.name, ' (') > 0 THEN substr(j.name, 1, instr(j.name, ' (') - 1) ELSE j.name END, 'test / ', '') AS job, j.os, g.name, sum(g.duration_ms) / 1000.0 AS total, max(g.duration_ms) / 1000.0 AS slowest FROM ci_step_groups g JOIN ci_jobs j ON j.run_id = g.run_id AND j.run_attempt = g.run_attempt AND j.job_id = g.job_id JOIN ci_runs r ON r.run_id = g.run_id AND r.run_attempt = g.run_attempt WHERE r.workflow = 'Test' AND r.conclusion = 'success' AND r.code_changed = 1 AND j.conclusion = 'success' GROUP BY 1, 2, 3) SELECT s.job, s.os, s.name, round(s.total / n.runs, 1) AS avg_seconds, round(s.slowest, 1) AS slowest_seconds FROM spent s JOIN job_runs n ON n.job = s.job AND n.os = s.os ORDER BY avg_seconds DESC LIMIT 40"}
```

**Log group trend** (time series): the average seconds of one log group for each week, with a line for each operating system. A query variable named `group` lists the groups. A public dashboard does not support template variables and sends `$group` unchanged, so the query uses `Run npm ci` when the parameter is empty or starts with `$`.

```json
{"sql":"WITH f(name) AS (SELECT CASE WHEN ?1 = '' OR substr(?1, 1, 1) = '$' THEN 'Run npm ci' ELSE ?1 END) SELECT date(substr(g.date, 1, 10), 'weekday 0', '-6 days') AS date, avg(CASE WHEN j.os = 'linux' THEN g.duration_ms END) / 1000.0 AS linux, avg(CASE WHEN j.os = 'macos' THEN g.duration_ms END) / 1000.0 AS macos, avg(CASE WHEN j.os = 'windows' THEN g.duration_ms END) / 1000.0 AS windows FROM ci_step_groups g JOIN ci_jobs j ON j.run_id = g.run_id AND j.run_attempt = g.run_attempt AND j.job_id = g.job_id, f WHERE g.name = f.name GROUP BY 1 ORDER BY 1","params":["$group"]}
```

The query of the `group` variable:

```json
{"sql":"SELECT name FROM ci_step_groups GROUP BY name HAVING count(*) >= 5 ORDER BY sum(duration_ms) DESC LIMIT 50"}
```

**Runs with a flaky test** (time series): the share of runs of each suite in which at least one test passed on a retry, for each week.

```json
{"sql":"SELECT date(substr(date, 1, 10), 'weekday 0', '-6 days') AS date, 100.0 * sum(CASE WHEN suite = 'unit' AND flaky > 0 THEN 1 END) / sum(CASE WHEN suite = 'unit' THEN 1 END) AS unit, 100.0 * sum(CASE WHEN suite = 'integration' AND flaky > 0 THEN 1 END) / sum(CASE WHEN suite = 'integration' THEN 1 END) AS integration, 100.0 * sum(CASE WHEN suite = 'e2e' AND flaky > 0 THEN 1 END) / sum(CASE WHEN suite = 'e2e' THEN 1 END) AS e2e FROM ci_test_suites GROUP BY 1 ORDER BY 1"}
```

**Flakiest tests** (table): the ten tests that most often passed on a retry. `rate_pct` is the share of suite runs in which the test was flaky. A test that runs on four operating systems counts once for each run.

```json
{"sql":"WITH runs(suite, total) AS (SELECT suite, count(*) FROM ci_test_suites GROUP BY suite) SELECT e.file, e.title, e.suite, count(*) AS flaky_runs, r.total AS suite_runs, round(100.0 * count(*) / r.total, 1) AS rate_pct, max(e.date) AS last_seen FROM ci_test_exceptions e JOIN runs r ON r.suite = e.suite WHERE e.status = 'flaky' GROUP BY e.file, e.title, e.suite ORDER BY flaky_runs DESC, last_seen DESC LIMIT 10"}
```

## Local development

Run these commands in this folder.

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

```bash
npm run migrate:local
```

```bash
npm run dev
```

```bash
npm test
```

The tests run in `workerd` with a local D1 that has the migrations applied.

## Deploy

```bash
npx wrangler login
```

```bash
npx wrangler d1 create monfil-complexity
```

The database keeps its first name, `monfil-complexity`, because Cloudflare cannot rename a D1 database. Copy the `database_id` from the output into `wrangler.jsonc`, then apply the migrations and deploy.

```bash
npm run migrate:remote
```

```bash
npm run deploy
```

Set each token as a secret. Wrangler asks for the value.

```bash
npx wrangler secret put INGEST_TOKEN
```

```bash
npx wrangler secret put QUERY_TOKEN
```

One complexity ingest writes about 3,400 rows, and one coverage ingest about 730. A second ingest of the same sha writes about twice that, because deletes count as writes. The free plan allows 100,000 rows written per day.
