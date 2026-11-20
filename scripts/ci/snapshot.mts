import type { LogGroup } from './log-groups.mts';
import type { SuiteName, SuiteReport, TestException } from './test-report.mts';

/** The parts of a workflow run from the GitHub API that the snapshot needs. */
export interface ApiRun {
  id: number;
  run_attempt: number;
  name: string;
  event: string;
  head_sha: string;
  head_branch: string | null;
  conclusion: string | null;
  created_at: string;
  run_started_at?: string | null;
  updated_at: string;
}

export interface ApiStep {
  name: string;
  number: number;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ApiJob {
  id: number;
  name: string;
  conclusion: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  labels: string[];
  steps?: ApiStep[];
}

export interface SuiteResult {
  suite: SuiteName;
  runner: string;
  report: SuiteReport;
}

type Os = 'linux' | 'macos' | 'windows' | 'other';

export interface SnapshotJob {
  id: number;
  name: string;
  runner: string;
  os: Os;
  conclusion: string;
  queue_seconds: number | null;
  duration_seconds: number | null;
  steps: { number: number; name: string; conclusion: string; duration_seconds: number | null }[];
  groups: LogGroup[];
}

/** The body of `POST /ci/ingest`. */
export interface CiSnapshot {
  sha: string;
  date: string;
  run: {
    id: number;
    attempt: number;
    workflow: string;
    event: string;
    branch: string;
    conclusion: string;
    full_matrix: boolean;
    code_changed: boolean;
    wall_seconds: number;
  };
  jobs: SnapshotJob[];
  suites: { suite: SuiteName; runner: string; tests: number; passed: number; failed: number; skipped: number; flaky: number }[];
  exceptions: (TestException & { suite: SuiteName; runner: string })[];
}

/** Whole seconds between two timestamps, or null when one is missing or the end is not after the start. */
export function secondsBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) {
    return null;
  }
  const milliseconds = Date.parse(to) - Date.parse(from);
  return Number.isNaN(milliseconds) ? null : Math.max(0, Math.round(milliseconds / 1000));
}

export function osOf(runner: string): Os {
  if (runner.startsWith('ubuntu')) {
    return 'linux';
  }
  if (runner.startsWith('macos')) {
    return 'macos';
  }
  return runner.startsWith('windows') ? 'windows' : 'other';
}

function snapshotJob(job: ApiJob, groups: readonly LogGroup[]): SnapshotJob {
  const runner = job.labels[0] ?? '';
  return {
    id: job.id,
    name: job.name,
    runner,
    os: osOf(runner),
    conclusion: job.conclusion ?? 'unknown',
    queue_seconds: secondsBetween(job.created_at, job.started_at),
    duration_seconds: secondsBetween(job.started_at, job.completed_at),
    steps: (job.steps ?? []).map((step) => ({
      number: step.number,
      name: step.name,
      conclusion: step.conclusion ?? 'unknown',
      // GitHub gives a skipped step the time of its neighbor, so a duration would be noise.
      duration_seconds: step.conclusion === 'skipped' ? null : secondsBetween(step.started_at, step.completed_at),
    })),
    groups: [...groups],
  };
}

/**
 * Joins a run, its jobs, the log groups of each job (by job id) and its test reports. A run without any test report is a run
 * that skipped the tests, such as a documentation-only pull request, so `code_changed` is false.
 */
export function buildSnapshot(
  run: ApiRun,
  apiJobs: ApiJob[],
  results: SuiteResult[],
  groups: ReadonlyMap<number, readonly LogGroup[]> = new Map(),
): CiSnapshot {
  const jobs = apiJobs.map((job) => snapshotJob(job, groups.get(job.id) ?? []));
  const start = run.run_started_at ?? run.created_at;
  return {
    sha: run.head_sha,
    date: start,
    run: {
      id: run.id,
      attempt: run.run_attempt,
      workflow: run.name,
      event: run.event,
      branch: run.head_branch ?? 'unknown',
      conclusion: run.conclusion ?? 'unknown',
      full_matrix: jobs.some((job) => job.os === 'macos' || job.os === 'windows'),
      code_changed: results.length > 0,
      wall_seconds: secondsBetween(start, run.updated_at) ?? 0,
    },
    jobs,
    suites: results.map(({ suite, runner, report }) => ({
      suite,
      runner,
      tests: report.tests,
      passed: report.passed,
      failed: report.failed,
      skipped: report.skipped,
      flaky: report.flaky,
    })),
    exceptions: results.flatMap(({ suite, runner, report }) => report.exceptions.map((exception) => ({ suite, runner, ...exception }))),
  };
}
