import { describe, expect, it } from 'vitest';
import { buildSnapshot, osOf, secondsBetween, type ApiJob, type ApiRun } from './snapshot.mts';
import type { SuiteResult } from './snapshot.mts';

const RUN: ApiRun = {
  id: 77,
  run_attempt: 2,
  name: 'Test',
  event: 'pull_request',
  head_sha: 'c'.repeat(40),
  head_branch: 'feature',
  conclusion: 'success',
  created_at: '2026-11-20T09:00:00Z',
  run_started_at: '2026-11-20T09:00:10Z',
  updated_at: '2026-11-20T09:05:10Z',
};

function job(overrides: Partial<ApiJob> = {}): ApiJob {
  return {
    id: 1,
    name: 'unit (ubuntu-latest)',
    conclusion: 'success',
    created_at: '2026-11-20T09:00:10Z',
    started_at: '2026-11-20T09:00:15Z',
    completed_at: '2026-11-20T09:02:15Z',
    labels: ['ubuntu-latest'],
    steps: [
      { name: 'Install Electron binary', number: 2, conclusion: 'success', started_at: '2026-11-20T09:00:20Z', completed_at: '2026-11-20T09:00:34Z' },
      { name: 'Run npm run test:unit', number: 3, conclusion: 'skipped', started_at: '2026-11-20T09:00:34Z', completed_at: '2026-11-20T09:00:34Z' },
    ],
    ...overrides,
  };
}

const RESULT: SuiteResult = {
  suite: 'unit',
  runner: 'ubuntu-latest',
  report: {
    tests: 3,
    passed: 3,
    failed: 0,
    skipped: 0,
    flaky: 1,
    exceptions: [{ file: 'src/a.test.ts', title: 'flakes', status: 'flaky', retries: 1, error: 'timeout' }],
  },
};

describe('buildSnapshot', () => {
  it('describes the run attempt, with the wall time from the start of that attempt', () => {
    // Act
    const snapshot = buildSnapshot(RUN, [job()], [RESULT]);

    // Assert
    expect(snapshot).toMatchObject({
      sha: RUN.head_sha,
      date: '2026-11-20T09:00:10Z',
      run: { id: 77, attempt: 2, workflow: 'Test', branch: 'feature', conclusion: 'success', wall_seconds: 300, code_changed: true, full_matrix: false },
    });
  });

  it('times each job and step, and gives a skipped step no duration', () => {
    // Act
    const [first] = buildSnapshot(RUN, [job()], []).jobs;

    // Assert
    expect(first).toMatchObject({ runner: 'ubuntu-latest', os: 'linux', queue_seconds: 5, duration_seconds: 120 });
    expect(first?.steps).toEqual([
      { number: 2, name: 'Install Electron binary', conclusion: 'success', duration_seconds: 14 },
      { number: 3, name: 'Run npm run test:unit', conclusion: 'skipped', duration_seconds: null },
    ]);
  });

  it('attaches the log groups to the job with the same id and gives the others none', () => {
    // Arrange
    const groups = new Map([[1, [{ name: 'Run npm ci', duration_ms: 134_000 }]]]);

    // Act
    const snapshot = buildSnapshot(RUN, [job(), job({ id: 2 })], [], groups);

    // Assert
    expect(snapshot.jobs.map((entry) => entry.groups)).toEqual([[{ name: 'Run npm ci', duration_ms: 134_000 }], []]);
  });

  it('keeps a job that never started with null times', () => {
    // Arrange
    const cancelled = job({ conclusion: 'cancelled', started_at: null, completed_at: null, labels: [] });
    delete cancelled.steps;

    // Act
    const [first] = buildSnapshot(RUN, [cancelled], []).jobs;

    // Assert
    expect(first).toMatchObject({ runner: '', os: 'other', conclusion: 'cancelled', queue_seconds: null, duration_seconds: null, steps: [] });
  });

  it('marks a run with a macOS or Windows job as a full matrix', () => {
    // Act
    const snapshot = buildSnapshot(RUN, [job(), job({ id: 2, labels: ['macos-latest'] })], []);

    // Assert
    expect(snapshot.run.full_matrix).toBe(true);
  });

  it('treats a run without test reports as a run without code changes', () => {
    // Act
    const snapshot = buildSnapshot(RUN, [job()], []);

    // Assert
    expect(snapshot.run.code_changed).toBe(false);
    expect(snapshot.suites).toEqual([]);
  });

  it('flattens the suite counts and exceptions, with the runner of each report', () => {
    // Act
    const snapshot = buildSnapshot(RUN, [job()], [RESULT]);

    // Assert
    expect(snapshot.suites).toEqual([{ suite: 'unit', runner: 'ubuntu-latest', tests: 3, passed: 3, failed: 0, skipped: 0, flaky: 1 }]);
    expect(snapshot.exceptions).toEqual([
      { suite: 'unit', runner: 'ubuntu-latest', file: 'src/a.test.ts', title: 'flakes', status: 'flaky', retries: 1, error: 'timeout' },
    ]);
  });

  it('falls back to the creation time and to unknown values when GitHub leaves them out', () => {
    // Arrange
    const run: ApiRun = { ...RUN, run_started_at: null, head_branch: null, conclusion: null };

    // Act
    const snapshot = buildSnapshot(run, [], []);

    // Assert
    expect(snapshot.date).toBe(RUN.created_at);
    expect(snapshot.run).toMatchObject({ branch: 'unknown', conclusion: 'unknown', wall_seconds: 310 });
  });
});

describe('secondsBetween', () => {
  it.each([
    ['a missing start', null, '2026-11-20T09:00:01Z', null],
    ['a missing end', '2026-11-20T09:00:00Z', undefined, null],
    ['a date that does not parse', 'nope', '2026-11-20T09:00:01Z', null],
    ['an end before the start', '2026-11-20T09:00:05Z', '2026-11-20T09:00:00Z', 0],
    ['a half second', '2026-11-20T09:00:00.000Z', '2026-11-20T09:00:01.600Z', 2],
  ])('handles %s', (_label, from, to, expected) => {
    // Act
    const result = secondsBetween(from, to);

    // Assert
    expect(result).toBe(expected);
  });
});

describe('osOf', () => {
  it.each([
    ['ubuntu-24.04', 'linux'],
    ['macos-15-intel', 'macos'],
    ['windows-latest', 'windows'],
    ['self-hosted', 'other'],
    ['', 'other'],
  ])('maps %s to %s', (runner, os) => {
    // Act
    const result = osOf(runner);

    // Assert
    expect(result).toBe(os);
  });
});
