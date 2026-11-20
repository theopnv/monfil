import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_GROUPS, MAX_JOBS, parseCiSnapshot, type CiGroup, type CiJob, type CiSnapshot } from '../src/ci/snapshot.ts';
import { ValidationError } from '../src/shared/expect.ts';

const SHA = 'b'.repeat(40);
const INGEST = 'test-ingest-token';
const QUERY = 'test-query-token';

function post(path: string, token: string | null, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return exports.default.fetch(new Request(`https://worker.test${path}`, { method: 'POST', headers, body: JSON.stringify(body) }));
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

function job(id: number, overrides: Partial<CiJob> = {}): CiJob {
  return {
    id,
    name: 'unit (ubuntu-latest)',
    runner: 'ubuntu-latest',
    os: 'linux',
    conclusion: 'success',
    queue_seconds: 3,
    duration_seconds: 120,
    steps: [
      { number: 1, name: 'Set up job', conclusion: 'success', duration_seconds: 1 },
      { number: 2, name: 'Install Electron binary', conclusion: 'success', duration_seconds: 14 },
      { number: 3, name: 'Run npm run test:integration', conclusion: 'skipped', duration_seconds: null },
    ],
    groups: [
      { name: 'Fetching the repository', duration_ms: 1500 },
      { name: 'Run npm ci', duration_ms: 134_000 },
    ],
    ...overrides,
  };
}

function snapshot(runId = 100, attempt = 1, overrides: Partial<CiSnapshot> = {}): CiSnapshot {
  return {
    sha: SHA,
    date: '2026-11-20T10:00:00+01:00',
    run: {
      id: runId,
      attempt,
      workflow: 'Test',
      event: 'pull_request',
      branch: 'feature',
      conclusion: 'success',
      full_matrix: false,
      code_changed: true,
      wall_seconds: 300,
    },
    jobs: [job(runId * 10 + 1), job(runId * 10 + 2, { name: 'e2e (ubuntu-latest)', duration_seconds: 240 })],
    suites: [
      { suite: 'unit', runner: 'ubuntu-latest', tests: 10, passed: 9, failed: 0, skipped: 1, flaky: 1 },
      { suite: 'e2e', runner: 'ubuntu-latest', tests: 4, passed: 4, failed: 0, skipped: 0, flaky: 0 },
    ],
    exceptions: [
      { suite: 'unit', runner: 'ubuntu-latest', file: 'src/a.test.ts', title: 'a flaky test', status: 'flaky', retries: 1, error: 'timeout' },
    ],
    ...overrides,
  };
}

beforeEach(async () => {
  await env.DB.batch(['ci_runs', 'ci_jobs', 'ci_steps', 'ci_step_groups', 'ci_test_suites', 'ci_test_exceptions'].map((table) => env.DB.prepare(`DELETE FROM ${table}`)));
});

describe('POST /ci/ingest', () => {
  it('stores the run, its jobs, steps, log groups, suites and exceptions', async () => {
    // Act
    const response = await post('/ci/ingest', INGEST, snapshot());

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sha: SHA, runId: 100, attempt: 1, jobs: 2, steps: 6, groups: 4, suites: 2, exceptions: 1 });
    expect(await env.DB.prepare('SELECT position, name, duration_ms FROM ci_step_groups WHERE job_id = 1001 ORDER BY position').all()).toMatchObject({
      results: [{ position: 0, name: 'Fetching the repository', duration_ms: 1500 }, { position: 1, name: 'Run npm ci', duration_ms: 134_000 }],
    });
    expect(await env.DB.prepare('SELECT date, workflow, full_matrix, code_changed, wall_seconds FROM ci_runs').first()).toEqual({
      date: '2026-11-20T09:00:00.000Z',
      workflow: 'Test',
      full_matrix: 0,
      code_changed: 1,
      wall_seconds: 300,
    });
    const skipped = await env.DB.prepare("SELECT duration_seconds FROM ci_steps WHERE conclusion = 'skipped' LIMIT 1").first();
    expect(skipped).toEqual({ duration_seconds: null });
    expect(await env.DB.prepare('SELECT status, retries FROM ci_test_exceptions').first()).toEqual({ status: 'flaky', retries: 1 });
  });

  it('replaces the rows of the same attempt and keeps the other attempts', async () => {
    // Arrange
    await post('/ci/ingest', INGEST, snapshot(100, 1));
    await post('/ci/ingest', INGEST, snapshot(100, 2));
    await post('/ci/ingest', INGEST, snapshot(200, 1));
    const changed = snapshot(100, 1, { jobs: [job(1001)], exceptions: [] });

    // Act
    const response = await post('/ci/ingest', INGEST, changed);

    // Assert
    expect(response.status).toBe(200);
    expect(await count('ci_runs')).toBe(3);
    expect(await count('ci_jobs')).toBe(5);
    expect(await count('ci_test_exceptions')).toBe(2);
  });

  it('stores two tests with the same title in one run', async () => {
    // Arrange
    const [exception] = snapshot().exceptions;

    // Act
    const response = await post('/ci/ingest', INGEST, snapshot(100, 1, { exceptions: [exception!, exception!] }));

    // Assert
    expect(response.status).toBe(200);
    expect(await count('ci_test_exceptions')).toBe(2);
  });

  it('refuses a request without the ingest token', async () => {
    // Act
    const missing = await post('/ci/ingest', null, snapshot());
    const wrong = await post('/ci/ingest', QUERY, snapshot());

    // Assert
    expect([missing.status, wrong.status]).toEqual([401, 401]);
    expect(await count('ci_runs')).toBe(0);
  });

  it('refuses an invalid snapshot with 400', async () => {
    // Act
    const response = await post('/ci/ingest', INGEST, { ...snapshot(), jobs: 'none' });

    // Assert
    expect(response.status).toBe(400);
  });

  it('stores nothing when one table refuses a row', async () => {
    // Arrange
    const bad = snapshot(100, 1, { suites: [{ suite: 'unit', runner: 'ubuntu-latest', tests: 3, passed: 2, failed: 0, skipped: 1, flaky: 3 }] });

    // Act
    const response = await post('/ci/ingest', INGEST, bad);

    // Assert
    expect(response.status).toBe(422);
    expect(await count('ci_runs')).toBe(0);
  });
});

describe('POST /ci/query', () => {
  it('runs a query on the CI tables', async () => {
    // Arrange
    await post('/ci/ingest', INGEST, snapshot());

    // Act
    const response = await post('/ci/query', QUERY, { sql: 'SELECT name, duration_seconds FROM ci_jobs ORDER BY job_id' });

    // Assert
    expect(await response.json()).toMatchObject({
      rows: [{ name: 'unit (ubuntu-latest)', duration_seconds: 120 }, { name: 'e2e (ubuntu-latest)', duration_seconds: 240 }],
    });
  });

  it('refuses the tables of another domain, and the other routes refuse the CI tables', async () => {
    // Act
    const other = await post('/ci/query', QUERY, { sql: 'SELECT * FROM coverage_files' });
    const reverse = await post('/coverage/query', QUERY, { sql: 'SELECT * FROM ci_runs' });
    const unauthorized = await post('/ci/query', INGEST, { sql: 'SELECT * FROM ci_runs' });

    // Assert
    expect([other.status, reverse.status, unauthorized.status]).toEqual([400, 400, 401]);
  });

  it('computes a percentile of the run time per day by nearest rank', async () => {
    // Arrange
    const walls = [100, 200, 300, 400, 500];
    for (const [index, wall] of walls.entries()) {
      const base = snapshot(index + 1);
      await post('/ci/ingest', INGEST, { ...base, run: { ...base.run, wall_seconds: wall } });
    }
    const sql = `
      WITH ranked AS (
        SELECT wall_seconds,
          ROW_NUMBER() OVER (ORDER BY wall_seconds) AS n,
          COUNT(*) OVER () AS total
        FROM ci_runs
        WHERE workflow = 'Test' AND conclusion = 'success' AND code_changed = 1
      )
      SELECT MIN(CASE WHEN n >= 0.95 * total THEN wall_seconds END) AS p95,
        MIN(CASE WHEN n >= 0.5 * total THEN wall_seconds END) AS p50
      FROM ranked`;

    // Act
    const response = await post('/ci/query', QUERY, { sql });

    // Assert
    expect(await response.json()).toMatchObject({ rows: [{ p95: 500, p50: 300 }] });
  });
});

describe('parseCiSnapshot', () => {
  it('converts the date to UTC so that dates sort as text', () => {
    // Act
    const result = parseCiSnapshot(snapshot());

    // Assert
    expect(result.date).toBe('2026-11-20T09:00:00.000Z');
  });

  it.each([
    ['a bad sha', { ...snapshot(), sha: 'main' }],
    ['a workflow that is not tracked', { ...snapshot(), run: { ...snapshot().run, workflow: 'Docs lint' } }],
    ['a run without a conclusion', { ...snapshot(), run: { ...snapshot().run, conclusion: '' } }],
    ['a run flag that is not a boolean', { ...snapshot(), run: { ...snapshot().run, code_changed: 1 } }],
    ['a duration that is not an integer', { ...snapshot(), jobs: [job(1, { duration_seconds: 1.5 })] }],
    ['an operating system that is not known', { ...snapshot(), jobs: [job(1, { os: 'beos' as 'linux' })] }],
    ['a job without groups', { ...snapshot(), jobs: [{ ...job(1), groups: undefined }] }],
    ['a group without a duration', { ...snapshot(), jobs: [job(1, { groups: [{ name: 'Run npm ci' } as CiGroup] })] }],
    ['too many groups', { ...snapshot(), jobs: [job(1, { groups: Array.from({ length: MAX_GROUPS + 1 }, () => ({ name: 'g', duration_ms: 1000 })) })] }],
    ['too many jobs', { ...snapshot(), jobs: Array.from({ length: MAX_JOBS + 1 }, (_, index) => job(index + 1)) }],
    ['an exception with another status', { ...snapshot(), exceptions: [{ ...snapshot().exceptions[0], status: 'passed' }] }],
  ])('refuses %s', (_label, body) => {
    // Act
    const parse = () => parseCiSnapshot(body);

    // Assert
    expect(parse).toThrow(ValidationError);
  });
});
