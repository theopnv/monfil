-- One row for each test suite and first-parent commit on main, from the same run as the coverage tables.
-- `unit` is the Node Vitest project, `integration` the browser Vitest project, and `e2e` the Playwright suite.
CREATE TABLE coverage_tests (
  sha TEXT NOT NULL CHECK (length(sha) = 40),
  date TEXT NOT NULL,
  suite TEXT NOT NULL CHECK (suite IN ('unit', 'integration', 'e2e')),
  files INTEGER NOT NULL CHECK (typeof(files) = 'integer' AND files >= 0),
  tests INTEGER NOT NULL CHECK (typeof(tests) = 'integer' AND tests = passed + failed + skipped),
  passed INTEGER NOT NULL CHECK (typeof(passed) = 'integer' AND passed >= 0),
  failed INTEGER NOT NULL CHECK (typeof(failed) = 'integer' AND failed >= 0),
  skipped INTEGER NOT NULL CHECK (typeof(skipped) = 'integer' AND skipped >= 0),
  PRIMARY KEY (sha, suite)
) WITHOUT ROWID;

CREATE INDEX coverage_tests_suite_date ON coverage_tests (suite, date);
