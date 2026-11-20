---
title: CI health
description: How CI timings and flaky tests reach the dashboard, and how to read it.
sidebar:
  order: 13
---

Monfil records how long each CI run takes, where the time goes, and which tests pass only on a retry. The data lands in the same D1 database as the [complexity](../complexity/) and [coverage](../coverage/) metrics. The "CI Health" row of the Grafana dashboard shows it.

```text
Test, Publish ──> ci-health-ingest.yml ──> Worker /ci/ingest ──> D1 <── Worker /ci/query <── Grafana
```

## What the ingest records

`ci-health-ingest.yml` runs when a `Test` or `Publish` run finishes, whatever its conclusion. A re-run of a run is a new attempt with its own rows. The workflow runs from the default branch, so a change to it takes effect only after it lands in `main`.

| Table | One row for each | Holds |
| --- | --- | --- |
| `ci_runs` | Run attempt | Event, branch, conclusion, `full_matrix`, `code_changed`, wall time in seconds |
| `ci_jobs` | Job | Runner, operating system, conclusion, queue time, run time |
| `ci_steps` | Step of a job | Name, conclusion, duration in seconds. A skipped step has no duration |
| `ci_step_groups` | Log group of a job | Name, duration in milliseconds, for groups of a second or longer |
| `ci_test_suites` | Suite and runner | Counts of tests, passed, failed, skipped and flaky tests |
| `ci_test_exceptions` | Test that failed or needed a retry | File, title, status, retries, first line of the error |

Two columns need an explanation:

- `code_changed` is 0 when no test suite uploaded a report. That is the case for a documentation-only pull request, which skips the tests. Filter on `code_changed = 1` before you compare run times.
- `full_matrix` is 1 when the run has a macOS or Windows job: a pull request with the `full-ci` label, or a release. These runs are much slower, so a panel never mixes them with the rest.

### Steps and log groups

GitHub times a step to the second and shows a composite action as one step. `Run ./.github/actions/setup` is one row in `ci_steps`, and it hides `npm ci`, the Electron download and the cache restore. The log of the job has a `##[group]` line, with a timestamp, for each of them. The ingest cuts the log at those lines. A group lasts until the next group starts. A group shorter than a second is dropped, and the commit sha of an action is removed from its name.

`ci_step_groups` has no link to a row of `ci_steps`. The names are the lines of the log: `Fetching the repository` is a git step of `actions/checkout`, and `Run npm ci` is a step of the setup action. The ingest reads a log with a parser that ignores any line it does not know, so a change of the log format gives fewer rows and never a failed ingest.

## Find flaky tests

A flaky test fails, then passes on a retry. CI retries a failed test once, for the Node and browser Vitest projects and for every Playwright project. `vitest.node.config.mts`, `vitest.browser.config.mts` and `playwright.config.ts` set the retry when the `CI` variable is set, so a local run never retries.

A retried test that passes makes the job green. The dashboard is the only place that shows it. A test that fails twice fails the job and shows as `failed` in `ci_test_exceptions`.

`test.yml` writes one report for each suite and uploads it as the artifact `ci-report-<attempt>-<suite>-<runner>`:

| Suite | Report | Writer |
| --- | --- | --- |
| `unit`, `integration` | `unit.json`, `integration.json` | `scripts/ci/vitest-reporter.mts`. Vitest's own `json` reporter does not say which test passed on a retry, so the reporter reads `retryCount` and the failed attempts of each test |
| `e2e` | `e2e.json` | The Playwright `json` reporter |

A pull request controls these files, so the ingest treats them as untrusted data. It parses JSON, checks every field, cuts text to 300 characters, and never runs anything from the artifact. It skips a report that is invalid or larger than 50 MB and records the timings without it.

## Run the collector by hand

`scripts/ci/collect.mts` reads a finished run from the GitHub API and writes the snapshot that the Worker takes. This is the way to check a change to it, because the workflow cannot run before it is in `main`.

```bash
GITHUB_REPOSITORY=theopnv/monfil GITHUB_TOKEN="$(gh auth token)" node scripts/ci/collect.mts --run-id <id> --attempt 1 --reports <folder> --out snapshot.json
```

`--reports` is the folder that `actions/download-artifact` fills. A folder that does not exist gives a run without test reports. To upload the result, use the shared command with a local Worker or with the token of the real one:

```bash
DEVANALYTICS_INGEST_TOKEN=<token> node scripts/devanalytics/ingest-cli.mts /ci/ingest snapshot.json
```

There is no backfill. The history starts on the day that the ingest workflow lands in `main`.

## Deploy

The ingest fails until the Worker has the CI tables and routes. A failed ingest blocks no other workflow. In `infra/devanalytics-worker`, apply the migrations and deploy before you merge:

```bash
npm run migrate:remote
```

```bash
npm run deploy
```

A run writes about 250 rows, and a second ingest of the same attempt writes about twice that, because deletes count as writes. The free plan allows 100,000 rows per day.

## Run the dashboard

The dashboard has two sections. "Codebase Health" holds the complexity and coverage panels, and "CI Health" holds the panels below. They use the Infinity data source of the other panels, which sends the Worker's `QUERY_TOKEN` as the Bearer token (see [Code complexity](../complexity/#data-source)). Each CI panel posts to `https://monfil-devanalytics.tpenavaire.workers.dev/ci/query`.

SQLite has no percentile function. Each percentile panel numbers the rows of its group with `ROW_NUMBER()` and takes the first row whose number reaches the share of the group size, which is the nearest-rank method. A week with a few runs shows a p95 close to its maximum. Each panel buckets the data by the Monday of the week.

Percentile panels use runs of the `Test` workflow with `conclusion = 'success'` and `code_changed = 1`. Times are in seconds. Declare the `date` column as **Timestamp**, and keep a fixed time range on the dashboard, for the same reasons as in [Code complexity](../complexity/#panels).

### Panels

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
