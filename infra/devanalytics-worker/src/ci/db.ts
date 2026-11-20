import { replaceRunRows } from '../shared/replace.ts';
import type { CiSnapshot } from './snapshot.ts';

const INSERT_RUNS = `
INSERT INTO ci_runs (run_id, run_attempt, date, sha, workflow, event, branch, conclusion, full_matrix, code_changed, wall_seconds)
SELECT ?1, ?2, ?3, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6, value ->> 7
FROM json_each(?4)`;

const INSERT_JOBS = `
INSERT INTO ci_jobs (run_id, run_attempt, date, job_id, name, runner, os, conclusion, queue_seconds, duration_seconds)
SELECT ?1, ?2, ?3, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6
FROM json_each(?4)`;

const INSERT_STEPS = `
INSERT INTO ci_steps (run_id, run_attempt, date, job_id, number, name, conclusion, duration_seconds)
SELECT ?1, ?2, ?3, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4
FROM json_each(?4)`;

const INSERT_GROUPS = `
INSERT INTO ci_step_groups (run_id, run_attempt, date, job_id, position, name, duration_ms)
SELECT ?1, ?2, ?3, value ->> 0, value ->> 1, value ->> 2, value ->> 3
FROM json_each(?4)`;

const INSERT_SUITES = `
INSERT INTO ci_test_suites (run_id, run_attempt, date, suite, runner, tests, passed, failed, skipped, flaky)
SELECT ?1, ?2, ?3, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6
FROM json_each(?4)`;

const INSERT_EXCEPTIONS = `
INSERT INTO ci_test_exceptions (run_id, run_attempt, date, suite, runner, position, file, title, status, retries, error)
SELECT ?1, ?2, ?3, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6, value ->> 7
FROM json_each(?4)`;

/** Replaces every row of the snapshot's run attempt, so a second ingest of the same attempt changes nothing. */
export async function ingestCi(
  db: D1Database,
  snapshot: CiSnapshot,
): Promise<{ runId: number; attempt: number; jobs: number; steps: number; groups: number; suites: number; exceptions: number; rowsWritten: number }> {
  const { run, jobs, suites, exceptions } = snapshot;
  const runRows = [[
    snapshot.sha, run.workflow, run.event, run.branch, run.conclusion, Number(run.full_matrix), Number(run.code_changed), run.wall_seconds,
  ]];
  const jobRows = jobs.map((job) => [job.id, job.name, job.runner, job.os, job.conclusion, job.queue_seconds, job.duration_seconds]);
  const stepRows = jobs.flatMap((job) => job.steps.map((step) => [job.id, step.number, step.name, step.conclusion, step.duration_seconds]));
  const groupRows = jobs.flatMap((job) => job.groups.map((group, position) => [job.id, position, group.name, group.duration_ms]));
  const suiteRows = suites.map((s) => [s.suite, s.runner, s.tests, s.passed, s.failed, s.skipped, s.flaky]);
  const exceptionRows = exceptions.map((e, position) => [e.suite, e.runner, position, e.file, e.title, e.status, e.retries, e.error]);
  const written = await replaceRunRows(db, run.id, run.attempt, snapshot.date, [
    { table: 'ci_runs', insert: INSERT_RUNS, rows: runRows },
    { table: 'ci_jobs', insert: INSERT_JOBS, rows: jobRows },
    { table: 'ci_steps', insert: INSERT_STEPS, rows: stepRows },
    { table: 'ci_step_groups', insert: INSERT_GROUPS, rows: groupRows },
    { table: 'ci_test_suites', insert: INSERT_SUITES, rows: suiteRows },
    { table: 'ci_test_exceptions', insert: INSERT_EXCEPTIONS, rows: exceptionRows },
  ]);
  return {
    runId: run.id,
    attempt: run.attempt,
    jobs: jobRows.length,
    steps: stepRows.length,
    groups: groupRows.length,
    suites: suiteRows.length,
    exceptions: exceptionRows.length,
    rowsWritten: written,
  };
}
