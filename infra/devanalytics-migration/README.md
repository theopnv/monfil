# Copy the old database

This folder is temporary. It copies the data of the old `monfil-complexity` D1 database into the Worker that you deploy from the Devanalytics template. Delete the folder after the copy.

The copy does not use the Worker. It does not count in the table `usage`, and D1 counts each row and each index entry as one write. The free plan allows 100,000 writes for each day and for the whole account. Do the copy on a day with no merge to `main`, and keep each day under 70,000 writes.

## Before you start

- Deploy the Worker from the template and run `npm run migrate:remote` in your fork of the template (task P1).
- Install `sqlite3`. macOS has it.
- Do step 1 before you merge the change that removes `infra/devanalytics-worker/` (task P2). The export reads the database from its `wrangler.jsonc`.
- Open a terminal in the folder that holds both repositories. The commands below use `copy` for a new folder beside them, `devanalytics` for the folder of your fork of the template, and `monfil` for the folder of this repository.

## Steps

1. Export the old database. This reads the database and changes nothing.

   ```
   mkdir copy
   cd monfil/infra/devanalytics-worker
   npx wrangler d1 export monfil-complexity --remote --output ../../../copy/old.sql
   ```

2. Build the old and the new database on your disk.

   ```
   cd copy
   sqlite3 old.db < old.sql
   cat ../devanalytics/migrations/*.sql | sqlite3 new.db
   ```

3. Copy the rows. The command prints the row count of each new table.

   ```
   sqlite3 new.db < ../monfil/infra/devanalytics-migration/copy.sql
   ```

   Compare the counts with the old database. `coverage_tests` has fewer rows: the suites `unit` and `integration` become one suite `vitest`. The tables `tests_suites` and `tests_exceptions` come from `ci_test_suites` and `ci_test_exceptions`. `ci_runs`, `ci_jobs`, `ci_steps` and `ci_step_groups` must have the same counts as before.

4. Write one SQL file for each table, in chunks.

   ```
   mkdir chunks
   for table in complexity_functions complexity_folder_summary coverage_files coverage_folder_summary coverage_tests ci_runs ci_jobs ci_steps ci_step_groups tests_suites tests_exceptions; do
     sqlite3 new.db ".dump $table" | grep '^INSERT' | split -l 5000 - "chunks/$table-"
   done
   ```

   Each statement is one line, because sqlite3 writes a new line in a text as `char(10)`. Check that `cat chunks/* | wc -l` equals the sum of the counts of step 3.

5. Run the chunks. Run each file, and check the usage after each one.

   ```
   cd ../devanalytics
   npx wrangler d1 execute DB --remote --file ../copy/chunks/<file>
   curl -H "Authorization: Bearer <QUERY_TOKEN>" <worker-url>/v1/usage
   ```

   The table `usage` stays at 0, because the copy bypasses the Worker. Count the writes yourself. A row in `complexity_functions` or `coverage_files` is 1 write. A row in any other table is 2 writes, because of its index. Stop when you reach 70,000 writes, and continue on the next day, after 00:00 UTC. A chunk that ran must not run again: it fails on its primary keys.

6. Compare. For a few commits, count the rows in the new database and in the old one.

   ```
   npx wrangler d1 execute DB --remote --command "SELECT count(*) FROM coverage_files WHERE suite = 'total'"
   ```

## If the copy is too large

Load only the release tags with the backfill command of the template:

```
npm run backfill -- --metric complexity --repo ../monfil --tags
npm run backfill -- --metric coverage --repo ../monfil --tags \
  --run "npm ci && npm run coverage:vitest" --input "reports=vitest=.vitest/coverage/coverage-final.json"
```

The backfill cannot load runs that are older than 90 days, so copy `ci_*` and `tests_*` with the steps above.
