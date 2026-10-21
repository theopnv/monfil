# Complexity Worker

A Cloudflare Worker that stores complexity snapshots from `scripts/complexity/` in D1.

- `POST /ingest` takes a snapshot from `npm run complexity` and replaces every row of its sha in one batch. It needs `Authorization: Bearer <INGEST_TOKEN>`.
- `POST /query` takes `{ "sql": "SELECT …", "params": [] }`, runs one `SELECT` or `WITH` statement, and returns at most 10,000 rows with D1's `meta`. It needs `Authorization: Bearer <QUERY_TOKEN>`.

## Tables

- `functions`: one row for each function in each commit. The primary key starts with `sha`.
- `folder_summary`: one row for each folder in the subtree of each file, for each commit and test flag. `src` includes `src/main`, so filter on one folder and never add up all rows. Use it for trend panels: one commit reads one row, and the same trend on `functions` reads every function.

To filter `functions` by folder, use `file GLOB 'src/main/*'`. D1 limits a `LIKE` or `GLOB` pattern to 50 bytes.

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

Copy the `database_id` from the output into `wrangler.jsonc`, then apply the migrations and deploy.

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

One ingest writes about 3,400 rows, and a second ingest of the same sha writes about twice that, because deletes count as writes. The free plan allows 100,000 rows written per day.
