-- One row for each attempt of a Test or Publish workflow run, whatever its conclusion.
-- `code_changed` is 0 when no test suite uploaded a report, which is the case for a documentation-only pull request.
-- Percentiles of `wall_seconds` and of job times only make sense on rows with `conclusion = 'success'` and `code_changed = 1`.
CREATE TABLE ci_runs (
  run_id INTEGER NOT NULL CHECK (typeof(run_id) = 'integer' AND run_id > 0),
  run_attempt INTEGER NOT NULL CHECK (typeof(run_attempt) = 'integer' AND run_attempt > 0),
  date TEXT NOT NULL,
  sha TEXT NOT NULL CHECK (length(sha) = 40),
  workflow TEXT NOT NULL CHECK (workflow IN ('Test', 'Publish')),
  event TEXT NOT NULL,
  branch TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  full_matrix INTEGER NOT NULL CHECK (full_matrix IN (0, 1)),
  code_changed INTEGER NOT NULL CHECK (code_changed IN (0, 1)),
  wall_seconds INTEGER NOT NULL CHECK (typeof(wall_seconds) = 'integer' AND wall_seconds >= 0),
  PRIMARY KEY (run_id, run_attempt)
) WITHOUT ROWID;

CREATE INDEX ci_runs_workflow_date ON ci_runs (workflow, date);

-- One row for each job. `runner` is the runs-on label, such as `macos-latest`. `queue_seconds` is the wait for a runner.
-- Both times are null for a job that never started.
CREATE TABLE ci_jobs (
  run_id INTEGER NOT NULL,
  run_attempt INTEGER NOT NULL,
  job_id INTEGER NOT NULL CHECK (typeof(job_id) = 'integer' AND job_id > 0),
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  runner TEXT NOT NULL,
  os TEXT NOT NULL CHECK (os IN ('linux', 'macos', 'windows', 'other')),
  conclusion TEXT NOT NULL,
  queue_seconds INTEGER CHECK (queue_seconds IS NULL OR (typeof(queue_seconds) = 'integer' AND queue_seconds >= 0)),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR (typeof(duration_seconds) = 'integer' AND duration_seconds >= 0)),
  PRIMARY KEY (run_id, run_attempt, job_id)
) WITHOUT ROWID;

CREATE INDEX ci_jobs_name_date ON ci_jobs (name, date);

-- One row for each step of each job. GitHub times a step to the second, so a fast step has a duration of 0.
-- A skipped step has no duration.
CREATE TABLE ci_steps (
  run_id INTEGER NOT NULL,
  run_attempt INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  number INTEGER NOT NULL CHECK (typeof(number) = 'integer' AND number > 0),
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR (typeof(duration_seconds) = 'integer' AND duration_seconds >= 0)),
  PRIMARY KEY (run_id, run_attempt, job_id, number)
) WITHOUT ROWID;

CREATE INDEX ci_steps_name_date ON ci_steps (name, date);

-- One row for each `##[group]` of the log of a job that lasted a second or longer, in log order. A group runs until the next group starts,
-- so it splits a composite action such as `Run ./.github/actions/setup` into `Run npm ci`, `Run actions/cache` and the like,
-- and it splits `actions/checkout` into its git steps. The names have the commit sha of an action removed.
CREATE TABLE ci_step_groups (
  run_id INTEGER NOT NULL,
  run_attempt INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK (typeof(position) = 'integer' AND position >= 0),
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (typeof(duration_ms) = 'integer' AND duration_ms >= 0),
  PRIMARY KEY (run_id, run_attempt, job_id, position)
) WITHOUT ROWID;

CREATE INDEX ci_step_groups_name_date ON ci_step_groups (name, date);

-- One row for each test suite and runner of a run. `unit` is the Node Vitest project, `integration` the browser Vitest project,
-- and `e2e` the Playwright suite. A flaky test passed on a retry, so `flaky` is part of `passed`.
CREATE TABLE ci_test_suites (
  run_id INTEGER NOT NULL,
  run_attempt INTEGER NOT NULL,
  suite TEXT NOT NULL CHECK (suite IN ('unit', 'integration', 'e2e')),
  runner TEXT NOT NULL,
  date TEXT NOT NULL,
  tests INTEGER NOT NULL CHECK (typeof(tests) = 'integer' AND tests = passed + failed + skipped),
  passed INTEGER NOT NULL CHECK (typeof(passed) = 'integer' AND passed >= 0),
  failed INTEGER NOT NULL CHECK (typeof(failed) = 'integer' AND failed >= 0),
  skipped INTEGER NOT NULL CHECK (typeof(skipped) = 'integer' AND skipped >= 0),
  flaky INTEGER NOT NULL CHECK (typeof(flaky) = 'integer' AND flaky >= 0 AND flaky <= passed),
  PRIMARY KEY (run_id, run_attempt, suite, runner)
) WITHOUT ROWID;

CREATE INDEX ci_test_suites_suite_date ON ci_test_suites (suite, date);

-- One row for each test that failed or needed a retry. A run without such a test writes no row here.
-- `position` keeps two tests with the same title apart.
CREATE TABLE ci_test_exceptions (
  run_id INTEGER NOT NULL,
  run_attempt INTEGER NOT NULL,
  suite TEXT NOT NULL CHECK (suite IN ('unit', 'integration', 'e2e')),
  runner TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (typeof(position) = 'integer' AND position >= 0),
  date TEXT NOT NULL,
  file TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('failed', 'flaky')),
  retries INTEGER NOT NULL CHECK (typeof(retries) = 'integer' AND retries >= 0),
  error TEXT NOT NULL,
  PRIMARY KEY (run_id, run_attempt, suite, runner, position)
) WITHOUT ROWID;

CREATE INDEX ci_test_exceptions_status_date ON ci_test_exceptions (status, date);
