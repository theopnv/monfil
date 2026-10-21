# Complexity setup guide

This guide is a map, not a finished solution. Each milestone tells you what to build, the concepts you need, hints, and how to check your result. You write the code. At the end of each milestone, come back to the chat for a review.

Each milestone gives value alone. Make each one its own PR.

## Decisions

| Topic | Decision |
| --- | --- |
| Metrics | Cyclomatic: `@sonarjs/cyclomatic-complexity`. Cognitive: `@sonarjs/cognitive-complexity`. The limits, the hook and the snapshot use the same two rules. |
| Scope of the limits | `src/` without `src/renderer/components/untitled-ui/` and without test files |
| Scope of the dashboard | Same as the limits, plus test files with an `is_test` flag |
| Limits | Cognitive 15, cyclomatic 10, both at `error` level |
| Old violations | ESLint bulk suppressions in `eslint-suppressions.json` |
| Agent feedback | Pre-commit (all agents) and a Claude Code `PostToolUse` hook (one file, after each edit) |
| PR feedback | One sticky comment: total change compared to the merge base, and the most complex functions. No line comments, no reviewdog. |
| PR comparison | CI computes both sides (PR head and merge base). D1 is not used for PRs. |
| Fork PRs | Compute in `pull_request`, post from a second workflow on `workflow_run` |
| Function identity | File and qualified name from the AST, for example `River > useEffect#1` |
| Data store | Cloudflare D1 behind a Worker, only for first-parent commits on `main` |
| Tables | `functions` (full snapshot for each commit) and a summary table (one row for each folder subtree for each commit) |
| Ingest | Replace by sha in one `db.batch()`. A separate job that does not block other jobs. |
| Read API | `POST /query` with SQL, behind a read token. Ingest uses a different token. |
| Code location | Script in `scripts/complexity/`. Worker in `infra/complexity-worker/` with its own `package.json` and `wrangler.jsonc`. |
| Dashboard v1 | Trend, folder breakdown, top functions, debt over time. A `folder` variable on all panels. |
| Later | Hotspots (complexity × churn), history of one function, "store only what changed" if the codebase grows about 10 times |

## Measured baseline

Measured on 2026-10-20 with the core `complexity` rule only (cyclomatic):

- 3,435 functions in `src/`
- 61 above 10, 26 above 15, 8 above 20
- Highest: `src/shared/embeds.ts:13` (55), `src/renderer/lib/reader/prepareReaderHtml.ts:27` (43), `src/main/feed/sources/youtube.ts:270` (28)

Write down the cognitive numbers when you finish milestone 1, so that you can compare them later.

---

## Milestone 1: ESLint rules

**Goal:** new code above the limits fails `npm run lint`, and old code does not.

### Concepts to learn

- **Cyclomatic complexity** counts the independent paths through a function: each `if`, `case`, loop, `&&`, `||`, `??` and `?:` adds one. It tells you how many tests a function needs.
- **Cognitive complexity** measures how hard code is to read. Nesting costs more than a flat structure, a `switch` costs less than a chain of `else if`, and breaks in linear flow (`break`, recursion) add to the score. Read the Sonar white paper "Cognitive Complexity: A new way of measuring understandability". It is short and shows how the score is calculated.
- **ESLint flat config:** each object in the array applies to the files that its `files` and `ignores` match. A later object overrides an earlier one.
- **Bulk suppressions:** read the ESLint docs page "Bulk Suppressions". Learn what `--suppress-rule`, `--prune-suppressions` and `--pass-on-unpruned-suppressions` do.

### Steps

1. Install `eslint-plugin-sonarjs` as a dev dependency. Version 4 supports ESLint 10.
2. In `eslint.config.ts`, add a config object for `src/**/*.{ts,tsx}` that turns on:
   - `complexity` with a maximum of 10
   - `sonarjs/cognitive-complexity` with a threshold of 15

   Register only the one rule you need. Do not use the plugin's `recommended` preset, or you get about 200 other rules.
3. Add a second object that turns both rules off for `src/renderer/components/untitled-ui/**` and for test files. Look at how the config already matches `src/renderer/**/*.test.{ts,tsx}`.
4. Run `npm run lint`. It should fail, and that is correct.
5. Create the suppressions with `npx eslint --suppress-rule complexity --suppress-rule sonarjs/cognitive-complexity .`. Do not use `--suppress-all`, because it would also hide violations of other rules.
6. Open `eslint-suppressions.json` and read it. Note that it counts violations for each file and each rule. It does not store line numbers.
7. Run `npm run lint` again. It should pass.

### Checks

- Write a function with five nested `if` statements in a new file in `src/main/`. `npm run lint` must fail with a cognitive complexity message.
- Put the same function in a file under `untitled-ui/`. Lint must pass.
- Add a second complex function to a file that already has a suppressed violation, for example `src/shared/embeds.ts`. Lint must fail, because the count went up.
- Simplify one suppressed function so that it goes below the limit. Run lint and look at what happens to the now unused suppression. Then run `--prune-suppressions`. You must understand this flow before milestone 2.
- Add a test in `eslint.config.test.ts`, in the same style as the existing tests: complex code in `src/main/` fails, and the same code in `untitled-ui/` passes.
- Remove your test code before you commit.

### Questions to think about

- The pre-commit hook runs `npm run lint`. What does an agent see when it fixes old debt but does not prune the suppressions?
- Add a short rule to `AGENTS.md` under "Changes and checks", so that every agent knows about the limits and the prune step.

**Checkpoint: show me your config diff and `eslint-suppressions.json`.**

---

## Milestone 2: Claude Code hook

**Goal:** after each edit of a source file, Claude sees the complexity errors for that file right away.

### Concepts to learn

- Read the Claude Code docs about hooks. Look at the `PostToolUse` event, the JSON that the hook gets on stdin (`tool_input.file_path`), and what exit code 2 does for a `PostToolUse` hook. Find out where stderr goes in that case.
- Look at the existing `PostToolUse` entry in `.claude/settings.json`. Your hook goes next to it, with the same `matcher`.

### Steps

1. Write a small Node script in `.claude/helpers/`. It reads the hook input from stdin, gets the file path, and stops with exit code 0 when the file is not a `.ts` or `.tsx` file under `src/`.
2. Run ESLint on that one file. Show only the two complexity rules. Find a way to do this that still applies `eslint-suppressions.json`. Otherwise an agent that edits `embeds.ts` gets blocked by debt that it did not create.
3. Decide what to do with unused suppressions in the hook. Hint: `--pass-on-unpruned-suppressions`.
4. When there are violations, write a short, clear message to stderr and exit with code 2. Include the function, the line, the score and the limit. Tell the agent to split the function. Do not tell it to add a suppression.
5. Add the hook to `.claude/settings.json` with a `timeout`.

### Checks

- Time the hook on a large file, such as `src/main/lib/fetch.ts`. Your config uses type-aware rules, so one file can take a few seconds. If the time is too long, find out which part is slow. Can the hook run without type information?
- Ask Claude to add a complex function. Claude must see the message after the edit and fix the function without your help.
- Edit `src/shared/embeds.ts` without changing its complex function. The hook must not complain.

**Checkpoint: show me the script and the timing.**

---

## Milestone 3: Metrics script

**Goal:** `npm run complexity -- --out snapshot.json` writes one record for each function, with both scores.

### Concepts to learn

- The ESLint Node API: `new ESLint({ overrideConfig })` and `lintFiles()`. With the limits set to 0, every function gives a message.
- The message formats. The core rule gives the kind, the name and the score in its message. The sonarjs rule gives only a location. Print some raw messages before you parse them.
- An AST (abstract syntax tree). Use `parse` from `@typescript-eslint/typescript-estree`, which is already installed through `typescript-eslint`. Use the AST Explorer website with the `@typescript-eslint/parser` option to look at the node types: `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`, `MethodDefinition`, `Property`, `VariableDeclarator`, `CallExpression`.

### Record format

Decide this format with care. Milestones 4, 5 and 6 depend on it.

```text
file, qualified_name, line, cyclomatic, cognitive, is_test
```

The snapshot also has the commit `sha` and `date` once, at the top.

### Steps

1. Create `scripts/complexity/` and an npm script `complexity`.
2. Run ESLint with only the two complexity rules, both at 0, on the scope from the decisions table. Test files are included and marked with `is_test`. This pass needs no type information, so turn it off to save time.
3. For each message, find the function node at that line and column. The two rules may report different columns for the same function. Find the smallest function node that contains the position, instead of an exact match.
4. Build the qualified name. Walk up from the node and collect names:
   - a function declaration or a method gives its own name
   - an arrow function in `const x = () => …` takes `x`
   - a callback takes the callee name, for example `useEffect` or `map`
   - join them with ` > `, and add `#n` when the same path appears more than once under the same parent
5. Join both scores into one record for each function. Write the JSON.

### Checks

- Compare your number of functions with the baseline (about 3,435 without tests).
- Look at 10 records in a large React component, for example `src/renderer/components/Home/River.tsx`. Are the names stable and readable?
- Add an empty line at the top of a file and run the script again. The qualified names must not change. Only `line` changes.
- Write unit tests for the naming function next to the script, as `*.test.ts`, with `// Arrange`, `// Act` and `// Assert`.

**Checkpoint: show me some records and your naming tests.**

---

## Milestone 4: PR comment

**Goal:** each PR has one comment that CI updates on each push. It shows the total change compared to the merge base and the most complex changed functions.

### Concepts to learn

- **Merge base:** `git merge-base origin/main HEAD`. Compare with it, not with the tip of `main`. Otherwise the merges of other PRs appear as changes. With `actions/checkout`, you need enough history (`fetch-depth: 0`).
- **`git worktree add`** to check out the merge base next to the PR code, so that you can run the script on both.
- **`pull_request` and `workflow_run`.** A PR from a fork gets a read-only `GITHUB_TOKEN` and no secrets. The safe pattern is to compute in a `pull_request` workflow, upload an artifact, and post the comment from a second workflow on `workflow_run`. Read the GitHub Security Lab article "Keeping your GitHub Actions and workflows secure: Preventing pwn requests".
- **A sticky comment:** find your old comment with a hidden marker such as `<!-- complexity-report -->` and edit it, or create it. You can use `gh api` or an existing action.

### Steps

1. Add a compare mode to the script: two snapshots in, Markdown out. Match functions by `file` and `qualified_name`. A function that exists on one side only is "new" or "removed".
2. Design the comment. Suggested content:
   - a total line: change in the sum of cognitive and cyclomatic complexity, and the number of new functions above the limits
   - a table of the changed or new functions, sorted by cognitive score, with both scores and the change
   - limit the table to about 15 rows
3. Add the compute job to `.github/workflows/test.yml` or to a new workflow. It runs the script on the head and on the merge base, compares them, and uploads the Markdown and the PR number as an artifact.
4. Add a second workflow on `workflow_run` that downloads the artifact and posts the comment.

### Security checks

- The second workflow must never check out or run code from the PR.
- The artifact comes from untrusted code. Do not trust the PR number in it. Check it with the GitHub API: the PR's head sha must equal `github.event.workflow_run.head_sha`. Note that `workflow_run.pull_requests` is empty for fork PRs, so you cannot use it.
- Function names come from the PR's code, and they go into Markdown. Escape them, so that a function name cannot add links, `@mentions` or HTML to your comment.
- Give the second workflow only `pull-requests: write`.

### Checks

- Run the compare mode locally with two shas before you write the workflow.
- Open a test PR that adds a complex function, then push a second commit. You must see one comment, updated, not two.

**Checkpoint: show me both workflows before you merge them.**

---

## Milestone 5: Worker and D1

**Goal:** a deployed Worker with `POST /ingest` and `POST /query` on a D1 database.

### Concepts to learn

- Read the Cloudflare docs: "Get started" for D1, D1 migrations, the D1 Worker binding API (`prepare`, `bind`, `all`, `batch`), and the D1 limits page. Find the limit on bound parameters for each statement and the free plan limits for rows read and rows written.
- `wrangler dev` with a local D1, so that you test without touching the remote database.
- Worker secrets with `wrangler secret put`, and `.dev.vars` for local values. Do not commit `.dev.vars`.

### Steps

1. Create `infra/complexity-worker/` with its own `package.json`, `wrangler.jsonc` and `tsconfig.json`. Use Wrangler in this folder.
2. Make sure the root project ignores this folder. The root `tsconfig.json` references only `src/main`, `src/preload` and `src/renderer`, but the root `eslint .` lints everything that is not ignored. Decide whether to add the folder to the ignores, or to lint it with its own config. Also check that Electron Forge does not package it.
3. Create the database and the first migration:
   - `functions`: `sha`, `date`, `file`, `qualified_name`, `line`, `cyclomatic`, `cognitive`, `is_test`
   - the summary table: `sha`, `date`, `folder`, `is_test`, function count, sums, maximums, count above the limits, and p90 if you want it
   - indexes for the queries you plan, at least on `sha` and on `(folder, date)` in the summary table
4. `/ingest`:
   - check `INGEST_TOKEN` (look at `crypto.subtle.timingSafeEqual` in Workers)
   - in one `db.batch()`: delete the rows for the sha in both tables, insert the snapshot in groups below the parameter limit, then fill the summary table
   - the summary needs one row for every folder in the subtree of each file. Think about how to get the list of folders from the file paths: in SQL, or in the Worker before the batch
5. `/query`:
   - check `QUERY_TOKEN`
   - accept only one statement that starts with `SELECT` or `WITH`, run it with `prepare().all()`, never with `exec()`
   - add a row limit to the result
6. Deploy, and set both secrets on the deployed Worker.

### Checks

- Locally, send a snapshot twice. The row count must stay the same.
- Stop an ingest in the middle (for example, send bad data in the last group). No partial rows must stay in D1.
- Send `DELETE FROM functions` to `/query`. It must be refused.
- Send a request with the query token to `/ingest`. It must be refused.
- Count the rows that a trend query reads. D1 returns this in `meta.rows_read`. Compare a query on `functions` with the same query on the summary table.

**Checkpoint: show me the schema and the ingest code.**

---

## Milestone 6: Ingest and backfill

**Goal:** each push to `main` adds a snapshot, and the 19 tags are in D1.

### Steps

1. Add a `complexity-ingest` job that runs only on `push` to `main`. It runs the script and posts the snapshot to `/ingest` with the `INGEST_TOKEN` secret.
2. Make sure it does not block other jobs or releases. Look at how `needs` works in `.github/workflows/test.yml`.
3. Write a backfill script that loops over the tags. For each tag: add a worktree, run the metrics script from your current checkout on that worktree, post the result, and remove the worktree. Use the current script and toolchain on the old source code.
4. Run it for the 19 tags. That is about 65,000 rows, below the daily write limit.

### Checks

- Push to `main` and look at the new rows in D1 with `wrangler d1 execute`.
- Re-run the job. The data must not double.
- Look at the "rows written" metric for the day in the Cloudflare dashboard.

---

## Milestone 7: Grafana dashboard

**Goal:** a Grafana Cloud dashboard with four panels, all filtered by a `folder` variable.

### Concepts to learn

- Grafana Cloud free tier: create an account and a stack.
- The Infinity data source plugin: a URL source with a POST body, a bearer token in the secure settings, and the "allowed hosts" setting. Learn how it parses a JSON response into columns.
- Dashboard variables: a query variable that lists the folders from the summary table, used as `$folder` in each panel's SQL.

### Panels

1. **Trend:** sum and max of both scores over time for `$folder`, from the summary table.
2. **Folder breakdown:** the child folders of `$folder` for the latest commit, as a bar chart.
3. **Top functions:** the 20 most complex functions under `$folder` for the latest commit, from `functions`, as a table.
4. **Debt over time:** the count above the limits for `$folder`. This count must go down over time.

### Traps

- Summary rows overlap: `src` includes `src/main`, which includes `src/main/feed`. Each panel must filter on one folder or on direct children. Never add up all the rows.
- Each panel refresh uses rows read. Keep trend panels on the summary table, and set a sensible refresh interval.

**Checkpoint: share a screenshot of the dashboard.**

---

## Later

- **Hotspots:** add churn for each file (`git log --format= --name-only` counts) to the snapshot and a new table. Then show complexity × churn.
- **History of one function:** a panel with a `qualified_name` variable. The data already exists in `functions`.
- **Contributor docs:** when the setup is stable, move the parts that contributors need into the contributor guide under `doc/src/content/docs/`.
