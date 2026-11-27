---
title: CI health
description: How CI timings and flaky tests reach the dashboard, and how to read it.
sidebar:
  order: 13
---

Monfil records how long each CI run takes, where the time goes, and which tests pass only on a retry. [Devanalytics](https://github.com/theopnv/devanalytics) stores the data in a Cloudflare D1 database, with the [complexity](../complexity/) and [coverage](../coverage/) metrics. The "CI Health" row of the Grafana dashboard shows it.

```text
Test, Publish ──> ci-health-ingest.yml ──> devanalytics Action (ci, tests) ──> Worker ──> D1 <── Grafana
```

## What the ingest records

`ci-health-ingest.yml` runs when a `Test` or `Publish` run finishes, whatever its conclusion. A re-run of a run is a new attempt with its own rows. The workflow runs from the default branch, so a change to it takes effect only after it lands in `main`. It has two jobs, one for each metric: `ci` and `tests`.

| Table | One row for each | Holds |
| --- | --- | --- |
| `ci_runs` | Run attempt | Workflow, event, branch, conclusion, wall time in seconds |
| `ci_jobs` | Job | Runner, operating system, conclusion, queue time, run time |
| `ci_steps` | Step of a job | Name, conclusion, duration in seconds. A skipped step has no duration |
| `ci_step_groups` | Log group of a job | Name, duration in milliseconds, for groups of a second or longer |
| `tests_suites` | Suite and runner | Counts of tests, passed, failed, skipped and flaky tests |
| `tests_exceptions` | Test that failed or needed a retry | File, title, status, retries, first line of the error |

The tables have no column for a documentation-only run or for a run with a macOS or Windows job. Filter a panel on `conclusion = 'success'`, and on the job names or runners, before you compare run times. The `runner` of a test row is the name of the report folder, for example `unit-ubuntu-latest`.

### Steps and log groups

GitHub times a step to the second and shows a composite action as one step. `Run ./.github/actions/setup` is one row in `ci_steps`, and it hides `npm ci`, the Electron download and the cache restore. The log of the job has a `##[group]` line, with a timestamp, for each of them. The Action cuts the log at those lines. A group lasts until the next group starts. A group shorter than a second is dropped, and the commit sha of an action is removed from its name.

`ci_step_groups` has no link to a row of `ci_steps`. The names are the lines of the log: `Fetching the repository` is a git step of `actions/checkout`, and `Run npm ci` is a step of the setup action. The parser ignores any line it does not know, so a change of the log format gives fewer rows and never a failed ingest.

## Find flaky tests

A flaky test fails, then passes on a retry. CI retries a failed test once, for the Node and browser Vitest projects and for every Playwright project. `vitest.node.config.mts`, `vitest.browser.config.mts` and `playwright.config.ts` set the retry when the `CI` variable is set, so a local run never retries.

A retried test that passes makes the job green. The dashboard is the only place that shows it. A test that fails twice fails the job and shows as `failed` in `tests_exceptions`.

`test.yml` writes one report for each suite and uploads it as the artifact `ci-report-<attempt>-<suite>-<runner>`:

| Suite | Report | Writer |
| --- | --- | --- |
| `unit`, `integration` | `unit.json`, `integration.json` | `scripts/devanalytics/vitest-reporter.mjs`, a copy of `action/reporters/vitest.mjs` of Devanalytics. Vitest's own `json` reporter does not say which test passed on a retry, so the reporter reads `retryCount` and the failed attempts of each test. It writes to the file in `DEVANALYTICS_VITEST_REPORT` |
| `e2e` | `e2e.json` | The Playwright `json` reporter |

A pull request controls these files, so the ingest treats them as untrusted data. The `tests` job downloads the artifacts and renames each folder to `<suite>-<runner>`. The Action parses the JSON, checks every field, cuts text to 300 characters, and never runs anything from the artifact. It skips a report that is invalid or larger than 50 MB and records the timings without it.

## Check a change by hand

The workflow cannot run before it is in `main`. To check a change to a report, run the collector of Devanalytics on a finished run. In a clone of Devanalytics:

```bash
npm run backfill -- --metric tests --repo theopnv/monfil --since <date> --dry-run \
  --input $'reports=unit=unit.json\nintegration=integration.json\ne2e=e2e.json'
```

Set `GITHUB_TOKEN` first, for example with `export GITHUB_TOKEN="$(gh auth token)"`. The command lists the runs and the rows that each one would write. GitHub keeps artifacts for 90 days.

## Deploy

The ingest needs the repository variable `DEVANALYTICS_URL` (the address of the Worker) and the repository secret `DEVANALYTICS_INGEST_TOKEN` (the `INGEST_TOKEN` of the Worker). A failed ingest blocks no other workflow. A run writes about 250 rows, and a second ingest of the same attempt writes about twice that, because deletes count as writes. The free plan allows 100,000 rows per day. `GET /v1/usage` on the Worker shows the rows written today.

## Run the dashboard

The "CI Health" section of the dashboard comes from `metrics/ci/dashboard.json` and `metrics/tests/dashboard.json` of Devanalytics. Import them as the [Grafana guide](https://github.com/theopnv/devanalytics/blob/main/docs/setup-grafana.md) describes. Keep a fixed time range on the dashboard, because Grafana's cache key includes it.
