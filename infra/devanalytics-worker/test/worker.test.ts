import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FunctionRow } from '../src/complexity/snapshot.ts';
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

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM complexity_functions'), env.DB.prepare('DELETE FROM complexity_folder_summary')]);
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
    ['a sqlite_ table', 'SELECT name FROM sqlite_master'],
  ])('refuses %s', async (_label, sql) => {
    // Act
    const response = await post('/complexity/query', QUERY, { sql });

    // Assert
    expect(response.status).toBe(400);
  });
});
