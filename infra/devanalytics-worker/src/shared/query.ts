import { KNOWN_TABLES } from './tables.ts';

export const MAX_QUERY_ROWS = 10_000;
const MAX_SQL_LENGTH = 10_000;
const MAX_PARAMS = 20;

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
 * SQLite has no dynamic SQL, so a query cannot reach a table without naming it. The match ignores
 * case and quotes, and it also refuses a CTE or an alias that reuses the name.
 */
function checkTables(sql: string, allowedTables: readonly string[]): void {
  const forbidden = KNOWN_TABLES.filter((table) => !allowedTables.includes(table));
  const alternatives = [...forbidden.map((table) => `${table}\\b`), 'sqlite_'];
  const match = new RegExp(`\\b(?:${alternatives.join('|')})`, 'i').exec(sql);
  if (match) {
    throw new QueryError(`sql must not use ${match[0]}`);
  }
}

/**
 * Accepts one SELECT or WITH statement on the allowed tables. A semicolon could start a second statement,
 * so none is allowed except at the end. `runQuery` also wraps the SQL in a subquery, where only a SELECT is valid syntax.
 */
export function parseQuery(value: unknown, allowedTables: readonly string[]): QueryRequest {
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
  checkTables(sql, allowedTables);
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
