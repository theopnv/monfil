import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface TestCounts {
  files: number;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface TestSuites {
  unit: TestCounts;
  integration: TestCounts;
  e2e: TestCounts;
}

/** The parts of Vitest's `json` reporter output that the counts need. */
export interface VitestResults {
  testResults: { name: string; assertionResults: { status: string }[] }[];
}

/** The parts of Playwright's `json` reporter output that the counts need. */
export interface PlaywrightResults {
  suites: unknown[];
  stats: { expected: number; unexpected: number; flaky: number; skipped: number };
}

/** The browser Vitest project includes `src/renderer/` and the Node project excludes it, so the path gives the project. */
const INTEGRATION_ROOT = 'src/renderer/';

const empty = (): TestCounts => ({ files: 0, tests: 0, passed: 0, failed: 0, skipped: 0 });

function add(counts: TestCounts, status: string): void {
  counts.tests += 1;
  if (status === 'passed') {
    counts.passed += 1;
  } else if (status === 'failed') {
    counts.failed += 1;
  } else {
    // pending, skipped, todo and disabled tests did not run.
    counts.skipped += 1;
  }
}

/** Counts the tests of one or more Vitest runs, split into the Node (`unit`) and browser (`integration`) projects. */
export function countVitest(runs: VitestResults[], root: string): Pick<TestSuites, 'unit' | 'integration'> {
  const result = { unit: empty(), integration: empty() };
  for (const file of runs.flatMap((run) => run.testResults)) {
    const relative = path.relative(root, file.name).split(path.sep).join('/');
    const counts = relative.startsWith(INTEGRATION_ROOT) ? result.integration : result.unit;
    counts.files += 1;
    file.assertionResults.forEach((test) => add(counts, test.status));
  }
  return result;
}

/** Counts the tests of a Playwright run. A flaky test passed on a retry. */
export function countPlaywright({ suites, stats }: PlaywrightResults): TestCounts {
  const passed = stats.expected + stats.flaky;
  return { files: suites.length, tests: passed + stats.unexpected + stats.skipped, passed, failed: stats.unexpected, skipped: stats.skipped };
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

/** Reads the reporter files of both runners. */
export async function loadTestSuites(vitestFiles: string[], playwrightFile: string, root: string): Promise<TestSuites> {
  const runs = await Promise.all(vitestFiles.map((file) => readJson<VitestResults>(file)));
  return { ...countVitest(runs, root), e2e: countPlaywright(await readJson<PlaywrightResults>(playwrightFile)) };
}
