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

The "CI Health" section of the dashboard reads `/ci/query` through the same Infinity setup as the "Codebase Health" section. Its panel queries and the `group` variable are in the [Worker README](https://github.com/theopnv/monfil/tree/main/infra/devanalytics-worker#ci-dashboard). Keep a fixed time range on the dashboard, because Grafana's cache key includes it.
