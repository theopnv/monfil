---
title: Code complexity
description: Complexity limits, the pull request report, and the dashboard that tracks them.
sidebar:
  order: 12
---

Monfil limits how complex a function in `src/` can get. ESLint enforces the limits, each pull request gets a report, and a [public dashboard](https://lavendercauliflower2001.grafana.net/public-dashboards/9f576515ea2549b8bf481752e7ad2a52) shows the trend on `main`.

```text
npm run lint ──> fails above the limits
PR ──> complexity.yml ──> complexity-comment.yml ──> sticky comment
main ──> complexity-ingest.yml ──> devanalytics Action ──> Worker ──> D1 <── Grafana
```

## Stay below the limits

Two ESLint rules from `eslint-plugin-sonarjs` apply to `src/**/*.{ts,tsx}`, configured in `eslint.config.ts`:

| Rule | Limit | What it measures |
| --- | --- | --- |
| `@sonarjs/cognitive-complexity` | 15 | How hard the code is to read. Nesting costs more than flat code. |
| `@sonarjs/cyclomatic-complexity` | 10 | The number of paths through the function, so the number of tests it needs. |

Test files and `src/renderer/components/untitled-ui/` have no limit. `npm run lint` and the pre-commit hook fail when a function goes above a limit.

When a function is above a limit, split it into smaller functions. Do not add an `eslint-disable` comment.

### Old violations

`eslint-suppressions.json` holds the violations that existed when the limits arrived. ESLint stores a count for each file and rule, with no line numbers. So when a file gets one more violation than its count, ESLint reports all of the violations of that rule in the file. Fix the function that you added or changed.

When you bring an old function below a limit, the suppression is no longer used and lint fails. Remove it and commit the smaller file:

```bash
npx eslint --prune-suppressions .
```

## Read the pull request report

Each pull request that changes `src/` gets one comment, which CI updates on each push. It compares the PR head with its merge base, so other merges into `main` do not show up as changes. The comment shows:

- new functions above the limits
- existing functions above the limits that got more complex
- functions that dropped below the limits, with a reminder to prune `eslint-suppressions.json`
- the number of functions that are above the limits in total

Each group lists up to 15 functions, the most complex first. When no function crossed the limits, the comment is one line.

Test files are not counted. A function that only moved to another line is not a change.

The work is split over two workflows, because a PR from a fork must not get a write token:

- `complexity.yml` runs on `pull_request` with a read-only token. It measures both sides and uploads a JSON diff. It runs the PR's code, so it never writes Markdown.
- `complexity-comment.yml` runs on `workflow_run` with `pull-requests: write`. It checks out only `scripts/complexity` and `scripts/devanalytics` from `main`, checks that the PR number and head sha in the artifact match the GitHub API, and renders the comment. Every name from the diff goes into a code span, so a function name cannot add links, mentions, or HTML.

`workflow_run` workflows run from the default branch. A change to `complexity-comment.yml` takes effect only after it lands in `main`.

To make the same report on your machine, check out the merge base next to your branch, measure both, and compare them:

```bash
git worktree add --detach ../monfil-base "$(git merge-base origin/main HEAD)"
```

```bash
npm run complexity -- --out head.json
```

```bash
npm run complexity -- --root ../monfil-base --out base.json
```

```bash
npm run complexity:report -- compare base.json head.json
```

## Measure functions

`npm run complexity -- --out snapshot.json` writes one record for each function in `src/`, test files included:

```json
{
  "sha": "28f4296…",
  "date": "2026-10-21T09:00:00+02:00",
  "functions": [
    { "file": "src/renderer/components/Home/River.tsx", "qualified_name": "River > visibleItems > useMemo", "line": 56, "cyclomatic": 2, "cognitive": 0, "is_test": false }
  ]
}
```

The script in `scripts/complexity/` runs the two rules with their limits at 0, without type information, and joins the scores for each function. Its inline ESLint config ignores the repository's own config, so the same rules also measure old commits.

`file` and `qualified_name` identify a function across commits. The name comes from the syntax tree, so a new line above a function changes only `line`:

| Code | Name |
| --- | --- |
| `function load() {}` | `load` |
| `const load = () => {}` | `load` |
| `useEffect(() => {})` inside `River` | `River > useEffect` |
| A second `useEffect` in `River` | `River > useEffect#2` |
| `const visible = useMemo(() => items.filter(…))` | `visible > useMemo > filter` |
| `class Store { get size() {} }` | `Store > get size` |
| `onPress={() => …}` | `onPress` |
| `return () => clear()` | `return` |

## Store the history

[Devanalytics](https://github.com/theopnv/devanalytics) stores the snapshots. Its GitHub Action measures the checkout in CI and sends one JSON snapshot to a Cloudflare Worker, which keeps it in a D1 database. The same Worker also stores [code coverage](../coverage/) and [CI health](../ci-health/). Its `complexity` metric measures with the same two rules and the same limits as the scripts in `scripts/complexity/`.

The database has two tables:

- `complexity_functions` has one row for each function in each commit.
- `complexity_folder_summary` has one row for each folder, commit, and test flag, with the function count, sums, maximums, and counts above the limits. The root `.` holds every file, `src` includes `src/main`, which includes `src/main/feed`. Filter a query on one folder, or on the direct children of one folder. Never add up all the rows.

Dates are stored in UTC. Use `complexity_folder_summary` for anything over time: one commit reads one row, and the same trend on `complexity_functions` reads every function.

### Ingest

`complexity-ingest.yml` measures each push to `main` that changes `src/`, and sends the snapshot to the Worker. It is its own workflow, so a failed upload never blocks tests or releases. It needs the repository variable `DEVANALYTICS_URL` (the address of the Worker) and the repository secret `DEVANALYTICS_INGEST_TOKEN` (the `INGEST_TOKEN` of the Worker). A test keeps the limits of the workflow equal to the limits in `scripts/complexity/limits.mts`.

To load old commits, run the backfill command of Devanalytics from a clone of it. It measures each commit in a temporary worktree and stays inside the daily write limit of D1:

```bash
npm run backfill -- --metric complexity --repo ../monfil --tags
```

Run the backfill again after a change to the rules, the limits, or the naming. Otherwise old rows and new rows were measured differently, and the trend shows a step that comes from the tool.

## Run the dashboard

The dashboard is in Grafana Cloud and reads the Worker's `/v1/complexity/query` endpoint through the Infinity plugin. Import `metrics/complexity/dashboard.json` of Devanalytics, and follow its [Grafana guide](https://github.com/theopnv/devanalytics/blob/main/docs/setup-grafana.md) for the data source and the `folder` variable. Keep a fixed time range on the dashboard, because Grafana's cache key includes it.
