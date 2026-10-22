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

Tables:

- `coverage_files`: one row for each source file, suite (`vitest`, `e2e` or `merged`) and commit, with covered and total counts for lines, statements, functions and branches.
- `coverage_folder_summary`: the same sums for each folder in the subtree of each file, with `file_count`. `src` includes `src/main`, so filter on one folder and never add up all rows.
- `coverage_tests`: one row for each test suite (`unit`, `integration` or `e2e`) and commit, with the counts of test files, tests, and passed, failed and skipped tests. It comes from the optional `tests` object of the snapshot. A snapshot without it removes the rows of its sha.

The tables store counts and never percents, so a sum of counts gives a correct percent. One ingest writes about 730 rows, and a second ingest of the same sha writes about twice that, because deletes count as writes.

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
