import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FunctionRow } from '../src/complexity/snapshot.ts';
import type { CoverageSnapshot, FileCoverage, TestCounts } from '../src/coverage/snapshot.ts';
import { CHUNK_SIZE } from '../src/shared/chunks.ts';
import { MAX_QUERY_ROWS } from '../src/shared/query.ts';

const SHA = 'a'.repeat(40);
const INGEST = 'test-ingest-token';
const QUERY = 'test-query-token';

function functions(count: number): FunctionRow[] {
  return Array.from({ length: count }, (_, index) => ({
    file: `src/main/dir${index % 7}/file${index % 13}.ts`,
    qualified_name: `fn${index}`,
    line: index + 1,
    cyclomatic: 1 + (index % 12),
    cognitive: index % 20,
    is_test: index % 5 === 0,
  }));
}

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

function coverageFiles(count: number): FileCoverage[] {
  return Array.from({ length: count }, (_, index) => ({
    file: `src/main/dir${index % 4}/file${index}.ts`,
    lines: [index % 5, 5],
    statements: [index % 6, 6],
    functions: [index % 2, 2],
    branches: [0, 0],
  }));
}

function coverageSnapshot(files: FileCoverage[], sha = SHA): CoverageSnapshot {
  return { sha, date: '2026-10-20T17:56:56+02:00', suites: { vitest: files, e2e: files.slice(0, 3), merged: files } };
}

function testCounts(passed: number, skipped = 0): TestCounts {
  return { files: 2, tests: passed + skipped, passed, failed: 0, skipped };
}

const TESTS = { unit: testCounts(120, 2), integration: testCounts(40), e2e: testCounts(15, 1) };

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM complexity_functions'),
    env.DB.prepare('DELETE FROM complexity_folder_summary'),
    env.DB.prepare('DELETE FROM coverage_files'),
    env.DB.prepare('DELETE FROM coverage_folder_summary'),
    env.DB.prepare('DELETE FROM coverage_tests'),
  ]);
});

describe('POST /complexity/ingest', () => {
  it('stores the snapshot in more than one chunk, with one summary row for each folder', async () => {
    // Arrange
    const snapshot = { sha: SHA, date: '2026-10-20T17:56:56+02:00', functions: functions(CHUNK_SIZE * 2 + 7) };

    // Act
    const response = await post('/complexity/ingest', INGEST, snapshot);

    // Assert
    expect(response.status).toBe(200);
    expect(await count('complexity_functions')).toBe(CHUNK_SIZE * 2 + 7);
    // src, src/main and 7 dirN folders, each for test and non-test functions.
    expect(await count('complexity_folder_summary')).toBe(18);
    const src = await env.DB.prepare("SELECT function_count, date FROM complexity_folder_summary WHERE folder = 'src' AND is_test = 0").first();
    expect(src).toEqual({ function_count: snapshot.functions.filter((fn) => !fn.is_test).length, date: '2026-10-20T15:56:56.000Z' });
  });

  it('replaces the rows of a sha that it already has', async () => {
    // Arrange
    const snapshot = { sha: SHA, date: '2026-10-20T00:00:00Z', functions: functions(40) };
    await post('/complexity/ingest', INGEST, snapshot);

    // Act
    const response = await post('/complexity/ingest', INGEST, snapshot);

    // Assert
    expect(response.status).toBe(200);
    expect(await count('complexity_functions')).toBe(40);
  });

  it('keeps the old rows when the last chunk fails', async () => {
    // Arrange
    await post('/complexity/ingest', INGEST, { sha: SHA, date: '2026-10-20T00:00:00Z', functions: functions(10) });
    const rows = functions(CHUNK_SIZE * 2 + 1);
    rows[rows.length - 1] = { ...rows[0]!, line: 9999 };

    // Act
    const response = await post('/complexity/ingest', INGEST, { sha: SHA, date: '2026-10-21T00:00:00Z', functions: rows });

    // Assert
    expect(response.status).toBe(422);
    expect(await count('complexity_functions')).toBe(10);
    expect(await count("complexity_folder_summary WHERE date = '2026-10-20T00:00:00.000Z'")).toBe(await count('complexity_folder_summary'));
  });

  it('lets a table constraint fail the whole batch', async () => {
    // Arrange
    const rows = functions(CHUNK_SIZE + 1);
    rows[rows.length - 1] = { ...rows[rows.length - 1]!, cyclomatic: 0 };

    // Act
    const response = await post('/complexity/ingest', INGEST, { sha: SHA, date: '2026-10-21T00:00:00Z', functions: rows });

    // Assert
    expect(response.status).toBe(422);
    expect(await count('complexity_functions')).toBe(0);
  });

  it.each([
    ['no token', null],
    ['the query token', QUERY],
    ['a wrong token', 'nope'],
  ])('refuses %s', async (_label, token) => {
    // Act
    const response = await post('/complexity/ingest', token, { sha: SHA, date: '2026-10-20T00:00:00Z', functions: functions(1) });

    // Assert
    expect(response.status).toBe(401);
    expect(await count('complexity_functions')).toBe(0);
  });

  it('refuses a snapshot with a bad shape', async () => {
    // Act
    const response = await post('/complexity/ingest', INGEST, { sha: 'main', functions: [] });

    // Assert
    expect(response.status).toBe(400);
  });
});

describe('POST /complexity/query', () => {
  beforeEach(async () => {
    await post('/complexity/ingest', INGEST, { sha: SHA, date: '2026-10-20T00:00:00Z', functions: functions(30) });
  });

  it('runs a SELECT with params and returns the rows and rows_read', async () => {
    // Act
    const response = await post('/complexity/query', QUERY, {
      sql: 'SELECT folder, function_count FROM complexity_folder_summary WHERE folder = ?1 AND is_test = 0;',
      params: ['src'],
    });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json<{ rows: unknown[]; truncated: boolean; meta: { rows_read: number } }>();
    expect(body.rows).toEqual([{ folder: 'src', function_count: 24 }]);
    expect(body.truncated).toBe(false);
    expect(body.meta.rows_read).toBeGreaterThan(0);
  });

  it('runs a WITH query', async () => {
    // Act
    const response = await post('/complexity/query', QUERY, { sql: 'WITH t AS (SELECT count(*) AS n FROM complexity_functions) SELECT n FROM t' });

    // Assert
    expect(await response.json()).toMatchObject({ rows: [{ n: 30 }] });
  });

  it.each([
    ['a DELETE', 'DELETE FROM complexity_functions'],
    ['a second statement', 'SELECT 1; DELETE FROM complexity_functions'],
    ['a DELETE behind a WITH', 'WITH t AS (SELECT 1) DELETE FROM complexity_functions'],
    ['a statement that closes the wrapper', 'SELECT 1) ; DROP TABLE complexity_functions; SELECT * FROM (SELECT 1'],
    ['a PRAGMA', 'PRAGMA table_list'],
  ])('refuses %s', async (_label, sql) => {
    // Act
    const response = await post('/complexity/query', QUERY, { sql });

    // Assert
    expect([400, 422]).toContain(response.status);
    expect(await count('complexity_functions')).toBe(30);
  });

  it('refuses the ingest token', async () => {
    // Act
    const response = await post('/complexity/query', INGEST, { sql: 'SELECT 1' });

    // Assert
    expect(response.status).toBe(401);
  });

  it(`returns at most ${MAX_QUERY_ROWS} rows and says so`, async () => {
    // Act
    const response = await post('/complexity/query', QUERY, {
      sql: `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${MAX_QUERY_ROWS + 5}) SELECT i FROM n`,
    });

    // Assert
    const body = await response.json<{ rows: unknown[]; truncated: boolean }>();
    expect(body.rows).toHaveLength(MAX_QUERY_ROWS);
    expect(body.truncated).toBe(true);
  });
});

describe('routing', () => {
  it('returns 404 for an unknown path and 405 for GET', async () => {
    // Act
    const missing = await exports.default.fetch(new Request('https://worker.test/nope', { method: 'POST' }));
    const get = await exports.default.fetch(new Request('https://worker.test/complexity/query'));

    // Assert
    expect(missing.status).toBe(404);
    expect(get.status).toBe(405);
  });

  it.each(['/ingest', '/query'])('returns 404 for the old path %s', async (path) => {
    // Act
    const response = await post(path, QUERY, { sql: 'SELECT 1' });

    // Assert
    expect(response.status).toBe(404);
  });
});

describe('POST /complexity/query tables', () => {
  it.each([
    ['a coverage table', 'SELECT * FROM coverage_files'],
    ['a quoted coverage table', 'SELECT * FROM "coverage_folder_summary"'],
    ['the test counts', 'SELECT * FROM coverage_tests'],
    ['a sqlite_ table', 'SELECT name FROM sqlite_master'],
  ])('refuses %s', async (_label, sql) => {
    // Act
    const response = await post('/complexity/query', QUERY, { sql });

    // Assert
    expect(response.status).toBe(400);
  });
});

describe('POST /coverage/ingest', () => {
  it('stores the files of each suite in more than one chunk, with one summary row for each folder and suite', async () => {
    // Arrange
    const snapshot = coverageSnapshot(coverageFiles(CHUNK_SIZE + 20));

    // Act
    const response = await post('/coverage/ingest', INGEST, snapshot);

    // Assert
    expect(response.status).toBe(200);
    expect(await count('coverage_files')).toBe(CHUNK_SIZE + 20 + 3 + CHUNK_SIZE + 20);
    // src, src/main and the dirN folders: 6 for vitest and merged, 5 for the three files of e2e.
    expect(await count('coverage_folder_summary')).toBe(6 + 5 + 6);
    const src = await env.DB.prepare("SELECT file_count, date FROM coverage_folder_summary WHERE folder = 'src' AND suite = 'e2e'").first();
    expect(src).toEqual({ file_count: 3, date: '2026-10-20T15:56:56.000Z' });
  });

  it('replaces the rows of a sha that it already has', async () => {
    // Arrange
    await post('/coverage/ingest', INGEST, coverageSnapshot(coverageFiles(40)));

    // Act
    const response = await post('/coverage/ingest', INGEST, coverageSnapshot(coverageFiles(10)));

    // Assert
    expect(response.status).toBe(200);
    expect(await count('coverage_files')).toBe(10 + 3 + 10);
  });

  it('keeps the other shas', async () => {
    // Arrange
    await post('/coverage/ingest', INGEST, coverageSnapshot(coverageFiles(5), 'b'.repeat(40)));

    // Act
    await post('/coverage/ingest', INGEST, coverageSnapshot(coverageFiles(5)));

    // Assert
    expect(await count('coverage_files')).toBe(2 * (5 + 3 + 5));
  });

  it('lets a table constraint fail the whole batch and keeps the old rows', async () => {
    // Arrange
    await post('/coverage/ingest', INGEST, coverageSnapshot(coverageFiles(5)));
    const broken = coverageFiles(5);
    broken[4] = { ...broken[4]!, lines: [9, 5] };

    // Act
    const response = await post('/coverage/ingest', INGEST, coverageSnapshot(broken));

    // Assert
    expect(response.status).toBe(422);
    expect(await count('coverage_files')).toBe(5 + 3 + 5);
  });

  it('stores one row of test counts for each suite', async () => {
    // Act
    const response = await post('/coverage/ingest', INGEST, { ...coverageSnapshot(coverageFiles(5)), tests: TESTS });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ testSuites: 3 });
    const rows = await env.DB.prepare('SELECT suite, files, tests, passed, failed, skipped, date FROM coverage_tests ORDER BY suite').all();
    expect(rows.results).toEqual([
      { suite: 'e2e', files: 2, tests: 16, passed: 15, failed: 0, skipped: 1, date: '2026-10-20T15:56:56.000Z' },
      { suite: 'integration', files: 2, tests: 40, passed: 40, failed: 0, skipped: 0, date: '2026-10-20T15:56:56.000Z' },
      { suite: 'unit', files: 2, tests: 122, passed: 120, failed: 0, skipped: 2, date: '2026-10-20T15:56:56.000Z' },
    ]);
  });

  it('removes the test counts of a sha when the new snapshot has none', async () => {
    // Arrange
    await post('/coverage/ingest', INGEST, { ...coverageSnapshot(coverageFiles(5)), tests: TESTS });

    // Act
    const response = await post('/coverage/ingest', INGEST, coverageSnapshot(coverageFiles(5)));

    // Assert
    expect(response.status).toBe(200);
    expect(await count('coverage_tests')).toBe(0);
  });

  it('refuses test counts that do not add up and keeps the old rows', async () => {
    // Arrange
    await post('/coverage/ingest', INGEST, { ...coverageSnapshot(coverageFiles(5)), tests: TESTS });
    const tests = { ...TESTS, e2e: { ...TESTS.e2e, tests: 99 } };

    // Act
    const response = await post('/coverage/ingest', INGEST, { ...coverageSnapshot(coverageFiles(2)), tests });

    // Assert
    expect(response.status).toBe(422);
    expect(await count('coverage_tests')).toBe(3);
    expect(await count('coverage_files')).toBe(5 + 3 + 5);
  });

  it.each([
    ['no token', null],
    ['the query token', QUERY],
  ])('refuses %s', async (_label, token) => {
    // Act
    const response = await post('/coverage/ingest', token, coverageSnapshot(coverageFiles(1)));

    // Assert
    expect(response.status).toBe(401);
    expect(await count('coverage_files')).toBe(0);
  });

  it('refuses a snapshot with a bad shape', async () => {
    // Act
    const response = await post('/coverage/ingest', INGEST, { sha: SHA, date: '2026-10-21', suites: {} });

    // Assert
    expect(response.status).toBe(400);
  });

  it('refuses a complexity snapshot', async () => {
    // Act
    const response = await post('/coverage/ingest', INGEST, { sha: SHA, date: '2026-10-20T00:00:00Z', functions: [] });

    // Assert
    expect(response.status).toBe(400);
  });
});

describe('POST /coverage/query', () => {
  beforeEach(async () => {
    await post('/coverage/ingest', INGEST, { ...coverageSnapshot(coverageFiles(20)), tests: TESTS });
    await post('/complexity/ingest', INGEST, { sha: SHA, date: '2026-10-20T00:00:00Z', functions: functions(5) });
  });

  it('runs a SELECT on the coverage tables', async () => {
    // Act
    const response = await post('/coverage/query', QUERY, {
      sql: "SELECT lines_covered, lines_total, file_count FROM coverage_folder_summary WHERE folder = ?1 AND suite = 'merged'",
      params: ['src'],
    });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json<{ rows: unknown[] }>();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({ lines_total: 100, file_count: 20 });
  });

  it('runs a SELECT on the test counts', async () => {
    // Act
    const response = await post('/coverage/query', QUERY, { sql: 'SELECT sum(tests) AS tests FROM coverage_tests WHERE sha = ?1', params: [SHA] });

    // Assert
    expect(response.status).toBe(200);
    expect((await response.json<{ rows: unknown[] }>()).rows).toEqual([{ tests: 122 + 40 + 16 }]);
  });

  it.each([
    ['a complexity table', 'SELECT * FROM complexity_functions'],
    ['a quoted complexity table', 'SELECT * FROM "Complexity_Folder_Summary"'],
    ['a CTE that has the name of a complexity table', 'WITH complexity_functions AS (SELECT 1) SELECT * FROM complexity_functions'],
    ['the schema table', 'SELECT name FROM sqlite_master'],
  ])('refuses %s', async (_label, sql) => {
    // Act
    const response = await post('/coverage/query', QUERY, { sql });

    // Assert
    expect(response.status).toBe(400);
  });

  it('refuses the ingest token', async () => {
    // Act
    const response = await post('/coverage/query', INGEST, { sql: 'SELECT 1' });

    // Assert
    expect(response.status).toBe(401);
  });
});

describe('GET /coverage/badge', () => {
  function srcLines(covered: number, total: number): FileCoverage[] {
    return [{ file: 'src/main/a.ts', lines: [covered, total], statements: [0, 0], functions: [0, 0], branches: [0, 0] }];
  }

  it('gives the merged line coverage of src for the newest snapshot, without a token', async () => {
    // Arrange
    await post('/coverage/ingest', INGEST, { ...coverageSnapshot(srcLines(889, 1000)), date: '2026-10-21T00:00:00Z' });
    await post('/coverage/ingest', INGEST, { ...coverageSnapshot(srcLines(50, 100), 'b'.repeat(40)), date: '2026-10-19T00:00:00Z' });

    // Act
    const response = await exports.default.fetch(new Request('https://worker.test/coverage/badge'));

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ schemaVersion: 1, label: 'coverage', message: '88.9%', color: 'brightgreen', cacheSeconds: 3600 });
  });

  it('says unknown when no coverage is stored', async () => {
    // Act
    const response = await exports.default.fetch(new Request('https://worker.test/coverage/badge'));

    // Assert
    expect(await response.json()).toEqual({ schemaVersion: 1, label: 'coverage', message: 'unknown', color: 'lightgrey', cacheSeconds: 3600 });
  });

  it('refuses POST', async () => {
    // Act
    const response = await post('/coverage/badge', QUERY, {});

    // Assert
    expect(response.status).toBe(405);
  });
});
