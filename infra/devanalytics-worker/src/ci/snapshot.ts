import {
  expectBoolean,
  expectDate,
  expectInteger,
  expectList,
  expectNullableInteger,
  expectObject,
  expectOneOf,
  expectSha,
  expectText,
} from '../shared/expect.ts';

export const WORKFLOWS = ['Test', 'Publish'] as const;
export const SUITES = ['unit', 'integration', 'e2e'] as const;
export const OSES = ['linux', 'macos', 'windows', 'other'] as const;
export const EXCEPTION_STATUSES = ['failed', 'flaky'] as const;

export const MAX_JOBS = 100;
export const MAX_STEPS = 200;
export const MAX_GROUPS = 200;
export const MAX_SUITES = 20;
export const MAX_EXCEPTIONS = 1000;

export interface CiRun {
  id: number;
  attempt: number;
  workflow: (typeof WORKFLOWS)[number];
  event: string;
  branch: string;
  conclusion: string;
  full_matrix: boolean;
  code_changed: boolean;
  wall_seconds: number;
}

export interface CiStep {
  number: number;
  name: string;
  conclusion: string;
  /** Null for a step that did not run. */
  duration_seconds: number | null;
}

/** A section of a job log, from its `##[group]` line to the next one. */
export interface CiGroup {
  name: string;
  duration_ms: number;
}

export interface CiJob {
  id: number;
  name: string;
  runner: string;
  os: (typeof OSES)[number];
  conclusion: string;
  queue_seconds: number | null;
  duration_seconds: number | null;
  steps: CiStep[];
  groups: CiGroup[];
}

export interface CiSuite {
  suite: (typeof SUITES)[number];
  runner: string;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  /** Passed on a retry, so part of `passed`. */
  flaky: number;
}

export interface CiException {
  suite: (typeof SUITES)[number];
  runner: string;
  file: string;
  title: string;
  status: (typeof EXCEPTION_STATUSES)[number];
  retries: number;
  error: string;
}

export interface CiSnapshot {
  /** The commit that the run tested. */
  sha: string;
  /** UTC ISO 8601 start of the run attempt, so that dates sort as text. */
  date: string;
  run: CiRun;
  jobs: CiJob[];
  suites: CiSuite[];
  exceptions: CiException[];
}

function parseRun(value: unknown): CiRun {
  const run = expectObject(value, 'run');
  return {
    id: expectInteger(run['id'], 'run.id'),
    attempt: expectInteger(run['attempt'], 'run.attempt'),
    workflow: expectOneOf(run['workflow'], 'run.workflow', WORKFLOWS),
    event: expectText(run['event'], 'run.event'),
    branch: expectText(run['branch'], 'run.branch'),
    conclusion: expectText(run['conclusion'], 'run.conclusion'),
    full_matrix: expectBoolean(run['full_matrix'], 'run.full_matrix'),
    code_changed: expectBoolean(run['code_changed'], 'run.code_changed'),
    wall_seconds: expectInteger(run['wall_seconds'], 'run.wall_seconds'),
  };
}

function parseStep(value: unknown, field: string): CiStep {
  const step = expectObject(value, field);
  return {
    number: expectInteger(step['number'], `${field}.number`),
    name: expectText(step['name'], `${field}.name`),
    conclusion: expectText(step['conclusion'], `${field}.conclusion`),
    duration_seconds: expectNullableInteger(step['duration_seconds'], `${field}.duration_seconds`),
  };
}

function parseGroup(value: unknown, field: string): CiGroup {
  const group = expectObject(value, field);
  return {
    name: expectText(group['name'], `${field}.name`),
    duration_ms: expectInteger(group['duration_ms'], `${field}.duration_ms`),
  };
}

function parseJob(value: unknown, index: number): CiJob {
  const field = `jobs[${index}]`;
  const job = expectObject(value, field);
  return {
    id: expectInteger(job['id'], `${field}.id`),
    name: expectText(job['name'], `${field}.name`),
    runner: expectText(job['runner'], `${field}.runner`),
    os: expectOneOf(job['os'], `${field}.os`, OSES),
    conclusion: expectText(job['conclusion'], `${field}.conclusion`),
    queue_seconds: expectNullableInteger(job['queue_seconds'], `${field}.queue_seconds`),
    duration_seconds: expectNullableInteger(job['duration_seconds'], `${field}.duration_seconds`),
    steps: expectList(job['steps'], `${field}.steps`, MAX_STEPS).map((step, i) => parseStep(step, `${field}.steps[${i}]`)),
    groups: expectList(job['groups'], `${field}.groups`, MAX_GROUPS).map((group, i) => parseGroup(group, `${field}.groups[${i}]`)),
  };
}

function parseSuite(value: unknown, index: number): CiSuite {
  const field = `suites[${index}]`;
  const suite = expectObject(value, field);
  return {
    suite: expectOneOf(suite['suite'], `${field}.suite`, SUITES),
    runner: expectText(suite['runner'], `${field}.runner`),
    tests: expectInteger(suite['tests'], `${field}.tests`),
    passed: expectInteger(suite['passed'], `${field}.passed`),
    failed: expectInteger(suite['failed'], `${field}.failed`),
    skipped: expectInteger(suite['skipped'], `${field}.skipped`),
    flaky: expectInteger(suite['flaky'], `${field}.flaky`),
  };
}

function parseException(value: unknown, index: number): CiException {
  const field = `exceptions[${index}]`;
  const exception = expectObject(value, field);
  return {
    suite: expectOneOf(exception['suite'], `${field}.suite`, SUITES),
    runner: expectText(exception['runner'], `${field}.runner`),
    file: expectText(exception['file'], `${field}.file`),
    title: expectText(exception['title'], `${field}.title`),
    status: expectOneOf(exception['status'], `${field}.status`, EXCEPTION_STATUSES),
    retries: expectInteger(exception['retries'], `${field}.retries`),
    error: expectText(exception['error'], `${field}.error`),
  };
}

/** Checks a snapshot written by `scripts/ci/collect.mts`. */
export function parseCiSnapshot(value: unknown): CiSnapshot {
  const snapshot = expectObject(value, 'snapshot');
  return {
    sha: expectSha(snapshot['sha']),
    date: expectDate(snapshot['date']),
    run: parseRun(snapshot['run']),
    jobs: expectList(snapshot['jobs'], 'jobs', MAX_JOBS).map(parseJob),
    suites: expectList(snapshot['suites'], 'suites', MAX_SUITES).map(parseSuite),
    exceptions: expectList(snapshot['exceptions'], 'exceptions', MAX_EXCEPTIONS).map(parseException),
  };
}
