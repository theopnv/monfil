# Devanalytics Worker

A Cloudflare Worker that stores development metrics in D1: the complexity snapshots from `scripts/complexity/` and the coverage snapshots from `scripts/coverage/`. The contributor guide page [Code complexity](../../doc/src/content/docs/contributor-guide/complexity.md) explains the whole setup, from the lint limits to the Grafana dashboard.

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
