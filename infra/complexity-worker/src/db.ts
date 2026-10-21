import { summarize, type Snapshot } from './snapshot.ts';

/** Rows bound as one JSON parameter for each statement. Far below the 2 MB value limit, and it keeps a batch at a few statements. */
export const CHUNK_SIZE = 500;
export const MAX_QUERY_ROWS = 10_000;
const MAX_SQL_LENGTH = 10_000;
const MAX_PARAMS = 20;

const INSERT_FUNCTIONS = `
INSERT INTO functions (sha, date, file, qualified_name, line, cyclomatic, cognitive, is_test)
SELECT ?1, ?2, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5
FROM json_each(?3)`;

const INSERT_SUMMARY = `
INSERT INTO folder_summary (sha, date, folder, is_test, function_count, cognitive_sum, cyclomatic_sum,
  cognitive_max, cyclomatic_max, cognitive_above, cyclomatic_above, above_limits)
SELECT ?1, ?2, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4,
  value ->> 5, value ->> 6, value ->> 7, value ->> 8, value ->> 9
FROM json_each(?3)`;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/** Replaces every row of the snapshot's sha in one batch, which D1 runs as a single transaction. */
export async function ingest(db: D1Database, snapshot: Snapshot): Promise<{ functions: number; folders: number; rowsWritten: number }> {
  const { sha, date } = snapshot;
  const functionRows = snapshot.functions.map((fn) =>
    [fn.file, fn.qualified_name, fn.line, fn.cyclomatic, fn.cognitive, Number(fn.is_test)]);
  const summaryRows = summarize(snapshot.functions).map((s) => [
    s.folder, Number(s.is_test), s.function_count, s.cognitive_sum, s.cyclomatic_sum,
    s.cognitive_max, s.cyclomatic_max, s.cognitive_above, s.cyclomatic_above, s.above_limits,
  ]);
  const statements = [
    db.prepare('DELETE FROM functions WHERE sha = ?1').bind(sha),
    db.prepare('DELETE FROM folder_summary WHERE sha = ?1').bind(sha),
    ...chunks(functionRows, CHUNK_SIZE).map((rows) => db.prepare(INSERT_FUNCTIONS).bind(sha, date, JSON.stringify(rows))),
    ...chunks(summaryRows, CHUNK_SIZE).map((rows) => db.prepare(INSERT_SUMMARY).bind(sha, date, JSON.stringify(rows))),
  ];
  const results = await db.batch(statements);
  const rowsWritten = results.reduce((total, result) => total + (result.meta.rows_written ?? 0), 0);
  return { functions: functionRows.length, folders: summaryRows.length, rowsWritten };
}

export class QueryError extends Error {
  override name = 'QueryError';
}

export interface QueryRequest {
  sql: string;
  params: (string | number | null)[];
}

function parseParams(value: unknown): QueryRequest['params'] {
  if (value === undefined) {
    return [];
  }
  const valid = Array.isArray(value) && value.length <= MAX_PARAMS
    && value.every((param) => param === null || typeof param === 'string' || typeof param === 'number');
  if (!valid) {
    throw new QueryError(`params must be an array of at most ${MAX_PARAMS} strings, numbers or nulls`);
  }
  return value as QueryRequest['params'];
}

/**
 * Accepts one SELECT or WITH statement. A semicolon could start a second statement, so none is allowed
 * except at the end. `runQuery` also wraps the SQL in a subquery, where only a SELECT is valid syntax.
 */
export function parseQuery(value: unknown): QueryRequest {
  const body = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const raw = body['sql'];
  if (typeof raw !== 'string' || raw.length > MAX_SQL_LENGTH) {
    throw new QueryError(`sql must be a string of at most ${MAX_SQL_LENGTH} characters`);
  }
  const sql = raw.trim().replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(sql)) {
    throw new QueryError('sql must start with SELECT or WITH');
  }
  if (sql.includes(';')) {
    throw new QueryError('sql must be one statement');
  }
  return { sql, params: parseParams(body['params']) };
}

export async function runQuery(db: D1Database, { sql, params }: QueryRequest) {
  // The line breaks keep a trailing `--` comment from hiding the closing parenthesis.
  const wrapped = `SELECT * FROM (\n${sql}\n) LIMIT ${MAX_QUERY_ROWS + 1}`;
  const result = await db.prepare(wrapped).bind(...params).all();
  const truncated = result.results.length > MAX_QUERY_ROWS;
  return {
    rows: truncated ? result.results.slice(0, MAX_QUERY_ROWS) : result.results,
    truncated,
    meta: { rows_read: result.meta.rows_read, rows_written: result.meta.rows_written, duration: result.meta.duration },
  };
}
