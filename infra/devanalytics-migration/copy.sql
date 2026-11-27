-- Copies the old monfil-complexity database into the tables of the Devanalytics template.
-- Run it with sqlite3 on a database that holds the template migrations, from the folder that holds old.db.
ATTACH 'old.db' AS old;

BEGIN;

INSERT INTO complexity_functions SELECT * FROM old.complexity_functions;
INSERT INTO complexity_folder_summary SELECT * FROM old.complexity_folder_summary;

-- The suite `merged` is `total` in the template.
INSERT INTO coverage_files
SELECT sha, date, CASE suite WHEN 'merged' THEN 'total' ELSE suite END, file,
  lines_covered, lines_total, statements_covered, statements_total,
  functions_covered, functions_total, branches_covered, branches_total
FROM old.coverage_files;

INSERT INTO coverage_folder_summary
SELECT sha, date, CASE suite WHEN 'merged' THEN 'total' ELSE suite END, folder,
  lines_covered, lines_total, statements_covered, statements_total,
  functions_covered, functions_total, branches_covered, branches_total, file_count
FROM old.coverage_folder_summary;

-- The `vitest` suite of the template counts the tests of the Node and the browser project together, as the old `unit` and `integration` did.
INSERT INTO coverage_tests
SELECT sha, date, 'vitest', sum(files), sum(tests), sum(passed), sum(failed), sum(skipped)
FROM old.coverage_tests
WHERE suite IN ('unit', 'integration')
GROUP BY sha, date;

INSERT INTO coverage_tests SELECT * FROM old.coverage_tests WHERE suite = 'e2e';

-- The template has no `full_matrix` and no `code_changed`, and `labels` is empty.
INSERT INTO ci_runs (run_id, run_attempt, date, sha, workflow, event, branch, conclusion, wall_seconds, labels)
SELECT run_id, run_attempt, date, sha, workflow, event, branch, conclusion, wall_seconds, NULL
FROM old.ci_runs;

INSERT INTO ci_jobs SELECT * FROM old.ci_jobs;
INSERT INTO ci_steps SELECT * FROM old.ci_steps;
INSERT INTO ci_step_groups SELECT * FROM old.ci_step_groups;

-- The Test workflow uploads one report artifact for each suite and operating system, and the `tests` metric names the runner after it.
-- The old rows get the same name, so that the old and the new rows of one runner stay together.
INSERT INTO tests_suites (run_id, run_attempt, date, suite, runner, tests, passed, failed, skipped, flaky)
SELECT run_id, run_attempt, date, suite, suite || '-' || runner, tests, passed, failed, skipped, flaky
FROM old.ci_test_suites;

INSERT INTO tests_exceptions (run_id, run_attempt, date, suite, runner, position, file, title, status, retries, error)
SELECT run_id, run_attempt, date, suite, suite || '-' || runner, position, file, title, status, retries, error
FROM old.ci_test_exceptions;

COMMIT;

SELECT 'complexity_functions', count(*) FROM complexity_functions
UNION ALL SELECT 'complexity_folder_summary', count(*) FROM complexity_folder_summary
UNION ALL SELECT 'coverage_files', count(*) FROM coverage_files
UNION ALL SELECT 'coverage_folder_summary', count(*) FROM coverage_folder_summary
UNION ALL SELECT 'coverage_tests', count(*) FROM coverage_tests
UNION ALL SELECT 'ci_runs', count(*) FROM ci_runs
UNION ALL SELECT 'ci_jobs', count(*) FROM ci_jobs
UNION ALL SELECT 'ci_steps', count(*) FROM ci_steps
UNION ALL SELECT 'ci_step_groups', count(*) FROM ci_step_groups
UNION ALL SELECT 'tests_suites', count(*) FROM tests_suites
UNION ALL SELECT 'tests_exceptions', count(*) FROM tests_exceptions;
