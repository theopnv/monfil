import { chunks, rowsWritten } from './chunks.ts';

export interface TableRows {
  table: string;
  /** Inserts the rows of the JSON array in ?3 for the sha in ?1 and the date in ?2. */
  insert: string;
  rows: unknown[][];
}

/** Replaces every row of one attempt of a run in each table. The insert binds the run id in ?1, the attempt in ?2, the date in ?3 and the JSON rows in ?4. */
export async function replaceRunRows(db: D1Database, runId: number, attempt: number, date: string, tables: TableRows[]): Promise<number> {
  const statements = [
    ...tables.map(({ table }) => db.prepare(`DELETE FROM ${table} WHERE run_id = ?1 AND run_attempt = ?2`).bind(runId, attempt)),
    ...tables.flatMap(({ insert, rows }) => chunks(rows).map((part) => db.prepare(insert).bind(runId, attempt, date, JSON.stringify(part)))),
  ];
  return rowsWritten(await db.batch(statements));
}

/** Replaces every row of `sha` in each table in one batch, which D1 runs as a single transaction. Returns the rows D1 wrote. */
export async function replaceRows(db: D1Database, sha: string, date: string, tables: TableRows[]): Promise<number> {
  const statements = [
    ...tables.map(({ table }) => db.prepare(`DELETE FROM ${table} WHERE sha = ?1`).bind(sha)),
    ...tables.flatMap(({ insert, rows }) => chunks(rows).map((part) => db.prepare(insert).bind(sha, date, JSON.stringify(part)))),
  ];
  return rowsWritten(await db.batch(statements));
}
