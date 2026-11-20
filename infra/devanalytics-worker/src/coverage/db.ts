import { replaceRows } from '../shared/replace.ts';
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

export async function ingestCoverage(
  db: D1Database,
  snapshot: CoverageSnapshot,
): Promise<{ files: number; folders: number; testSuites: number; rowsWritten: number }> {
  const { sha, date } = snapshot;
  const fileRows = SUITES.flatMap((suite) => snapshot.suites[suite].map((file) => [suite, file.file, ...fileSums(file)]));
  const summaryRows = summarizeCoverage(snapshot).map((s) => [s.suite, s.folder, ...s.sums, s.file_count]);
  const suiteRows = testRows(snapshot);
  const written = await replaceRows(db, sha, date, [
    { table: 'coverage_files', insert: INSERT_FILES, rows: fileRows },
    { table: 'coverage_folder_summary', insert: INSERT_SUMMARY, rows: summaryRows },
    { table: 'coverage_tests', insert: INSERT_TESTS, rows: suiteRows },
  ]);
  return { files: fileRows.length, folders: summaryRows.length, testSuites: suiteRows.length, rowsWritten: written };
}
