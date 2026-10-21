import { chunks, rowsWritten } from '../shared/chunks.ts';
import { summarize, type Snapshot } from './snapshot.ts';

const INSERT_FUNCTIONS = `
INSERT INTO complexity_functions (sha, date, file, qualified_name, line, cyclomatic, cognitive, is_test)
SELECT ?1, ?2, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5
FROM json_each(?3)`;

const INSERT_SUMMARY = `
INSERT INTO complexity_folder_summary (sha, date, folder, is_test, function_count, cognitive_sum, cyclomatic_sum,
  cognitive_max, cyclomatic_max, cognitive_above, cyclomatic_above, above_limits)
SELECT ?1, ?2, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4,
  value ->> 5, value ->> 6, value ->> 7, value ->> 8, value ->> 9
FROM json_each(?3)`;

/** Replaces every row of the snapshot's sha in one batch, which D1 runs as a single transaction. */
export async function ingestComplexity(db: D1Database, snapshot: Snapshot): Promise<{ functions: number; folders: number; rowsWritten: number }> {
  const { sha, date } = snapshot;
  const functionRows = snapshot.functions.map((fn) =>
    [fn.file, fn.qualified_name, fn.line, fn.cyclomatic, fn.cognitive, Number(fn.is_test)]);
  const summaryRows = summarize(snapshot.functions).map((s) => [
    s.folder, Number(s.is_test), s.function_count, s.cognitive_sum, s.cyclomatic_sum,
    s.cognitive_max, s.cyclomatic_max, s.cognitive_above, s.cyclomatic_above, s.above_limits,
  ]);
  const statements = [
    db.prepare('DELETE FROM complexity_functions WHERE sha = ?1').bind(sha),
    db.prepare('DELETE FROM complexity_folder_summary WHERE sha = ?1').bind(sha),
    ...chunks(functionRows).map((rows) => db.prepare(INSERT_FUNCTIONS).bind(sha, date, JSON.stringify(rows))),
    ...chunks(summaryRows).map((rows) => db.prepare(INSERT_SUMMARY).bind(sha, date, JSON.stringify(rows))),
  ];
  const results = await db.batch(statements);
  return { functions: functionRows.length, folders: summaryRows.length, rowsWritten: rowsWritten(results) };
}
