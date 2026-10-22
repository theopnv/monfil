import { expectDate, expectInteger, expectObject, expectSha, expectText, ValidationError } from '../shared/expect.ts';
import { folderPrefixes } from '../shared/folders.ts';

export const SUITES = ['vitest', 'e2e', 'merged'] as const;
export type Suite = (typeof SUITES)[number];
export const MAX_FILES = 5000;

const METRICS = ['lines', 'statements', 'functions', 'branches'] as const;
type Metric = (typeof METRICS)[number];

/** Covered and total counts for each metric, in the order of `METRICS`. */
export type Counts = Record<Metric, readonly [covered: number, total: number]>;

export interface FileCoverage extends Counts {
  file: string;
}

export const TEST_SUITES = ['unit', 'integration', 'e2e'] as const;
export type TestSuite = (typeof TEST_SUITES)[number];

const TEST_COUNTS = ['files', 'tests', 'passed', 'failed', 'skipped'] as const;

/** The counts of one test run, in the order of the table columns. */
export type TestCounts = Record<(typeof TEST_COUNTS)[number], number>;

export interface CoverageSnapshot {
  sha: string;
  /** UTC ISO 8601, so that dates sort as text. */
  date: string;
  suites: Record<Suite, FileCoverage[]>;
  /** Absent in a snapshot from before the test counts. */
  tests?: Record<TestSuite, TestCounts>;
}

export interface FolderCoverage {
  suite: Suite;
  folder: string;
  /** Eight counts in the order of the table columns: lines, statements, functions, branches, each covered then total. */
  sums: number[];
  file_count: number;
}

export class CoverageSnapshotError extends ValidationError {
  override name = 'CoverageSnapshotError';
}

function parsePair(value: unknown, field: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new CoverageSnapshotError(`${field} must be a pair of covered and total`);
  }
  return [expectInteger(value[0], `${field}[0]`), expectInteger(value[1], `${field}[1]`)];
}

function parseFile(value: unknown, field: string): FileCoverage {
  const entry = expectObject(value, field);
  return {
    file: expectText(entry['file'], `${field}.file`),
    lines: parsePair(entry['lines'], `${field}.lines`),
    statements: parsePair(entry['statements'], `${field}.statements`),
    functions: parsePair(entry['functions'], `${field}.functions`),
    branches: parsePair(entry['branches'], `${field}.branches`),
  };
}

function parseSuite(value: unknown, suite: Suite): FileCoverage[] {
  if (!Array.isArray(value) || value.length > MAX_FILES) {
    throw new CoverageSnapshotError(`suites.${suite} must be an array of at most ${MAX_FILES} items`);
  }
  return value.map((file: unknown, index) => parseFile(file, `suites.${suite}[${index}]`));
}

function parseTestCounts(value: unknown, field: string): TestCounts {
  const entry = expectObject(value, field);
  const counts = Object.fromEntries(TEST_COUNTS.map((name) => [name, expectInteger(entry[name], `${field}.${name}`)]));
  return counts as TestCounts;
}

function parseTests(value: unknown): CoverageSnapshot['tests'] {
  if (value === undefined) {
    return undefined;
  }
  const tests = expectObject(value, 'tests');
  return {
    unit: parseTestCounts(tests['unit'], 'tests.unit'),
    integration: parseTestCounts(tests['integration'], 'tests.integration'),
    e2e: parseTestCounts(tests['e2e'], 'tests.e2e'),
  };
}

/** Checks a snapshot written by `scripts/coverage/merge.mts`. */
export function parseCoverageSnapshot(value: unknown): CoverageSnapshot {
  const snapshot = expectObject(value, 'snapshot');
  const suites = expectObject(snapshot['suites'], 'suites');
  const tests = parseTests(snapshot['tests']);
  return {
    sha: expectSha(snapshot['sha']),
    date: expectDate(snapshot['date']),
    suites: {
      vitest: parseSuite(suites['vitest'], 'vitest'),
      e2e: parseSuite(suites['e2e'], 'e2e'),
      merged: parseSuite(suites['merged'], 'merged'),
    },
    ...(tests && { tests }),
  };
}

/** One row for each test suite, in the order of the table columns. Empty for a snapshot without test counts. */
export function testRows(snapshot: CoverageSnapshot): (string | number)[][] {
  const { tests } = snapshot;
  return tests ? TEST_SUITES.map((suite) => [suite, ...TEST_COUNTS.map((name) => tests[suite][name])]) : [];
}

export function fileSums(file: FileCoverage): number[] {
  return METRICS.flatMap((metric) => [...file[metric]]);
}

/** Builds one summary for each folder and suite, counting each file in every folder above it. */
export function summarizeCoverage(snapshot: CoverageSnapshot): FolderCoverage[] {
  const summaries = new Map<string, FolderCoverage>();
  for (const suite of SUITES) {
    for (const file of snapshot.suites[suite]) {
      const sums = fileSums(file);
      for (const folder of folderPrefixes(file.file)) {
        const key = `${suite}\u0000${folder}`;
        let summary = summaries.get(key);
        if (!summary) {
          summary = { suite, folder, sums: sums.map(() => 0), file_count: 0 };
          summaries.set(key, summary);
        }
        sums.forEach((sum, index) => {
          summary.sums[index] = (summary.sums[index] ?? 0) + sum;
        });
        summary.file_count += 1;
      }
    }
  }
  return [...summaries.values()];
}
