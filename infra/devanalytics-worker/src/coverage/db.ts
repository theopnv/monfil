import { chunks, rowsWritten } from '../shared/chunks.ts';
import { fileSums, SUITES, summarizeCoverage, testRows, type CoverageSnapshot } from './snapshot.ts';

const INSERT_FILES = `
INSERT INTO coverage_files (sha, date, suite, file, lines_covered, lines_total, statements_covered, statements_total,
  functions_covered, functions_total, branches_covered, branches_total)
SELECT ?1, ?2, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5,
  value ->> 6, value ->> 7, value ->> 8, value ->> 9
FROM json_each(?3)`;

const INSERT_SUMMARY = `
INSERT INTO coverage_folder_summary (sha, date, suite, folder, lines_covered, lines_total, statements_covered, statements_total,
  functions_covered, functions_total, branches_covered, branches_total, file_count)
SELECT ?1, ?2, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5,
  value ->> 6, value ->> 7, value ->> 8, value ->> 9, value ->> 10
FROM json_each(?3)`;

const INSERT_TESTS = `
INSERT INTO coverage_tests (sha, date, suite, files, tests, passed, failed, skipped)
SELECT ?1, ?2, value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5
FROM json_each(?3)`;

/** Replaces every row of the snapshot's sha in one batch, which D1 runs as a single transaction. */
export async function ingestCoverage(
  db: D1Database,
  snapshot: CoverageSnapshot,
): Promise<{ files: number; folders: number; testSuites: number; rowsWritten: number }> {
  const { sha, date } = snapshot;
  const fileRows = SUITES.flatMap((suite) => snapshot.suites[suite].map((file) => [suite, file.file, ...fileSums(file)]));
  const summaryRows = summarizeCoverage(snapshot).map((s) => [s.suite, s.folder, ...s.sums, s.file_count]);
  const suiteRows = testRows(snapshot);
  const statements = [
    db.prepare('DELETE FROM coverage_files WHERE sha = ?1').bind(sha),
    db.prepare('DELETE FROM coverage_folder_summary WHERE sha = ?1').bind(sha),
    db.prepare('DELETE FROM coverage_tests WHERE sha = ?1').bind(sha),
    ...chunks(fileRows).map((rows) => db.prepare(INSERT_FILES).bind(sha, date, JSON.stringify(rows))),
    ...chunks(summaryRows).map((rows) => db.prepare(INSERT_SUMMARY).bind(sha, date, JSON.stringify(rows))),
    ...chunks(suiteRows).map((rows) => db.prepare(INSERT_TESTS).bind(sha, date, JSON.stringify(rows))),
  ];
  const results = await db.batch(statements);
  return { files: fileRows.length, folders: summaryRows.length, testSuites: suiteRows.length, rowsWritten: rowsWritten(results) };
}
