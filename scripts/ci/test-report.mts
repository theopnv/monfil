import { stripVTControlCharacters } from 'node:util';

export const SUITES = ['unit', 'integration', 'e2e'] as const;
export type SuiteName = (typeof SUITES)[number];

export interface TestException {
  file: string;
  title: string;
  status: 'failed' | 'flaky';
  retries: number;
  error: string;
}

/** The counts of one test suite. A flaky test passed on a retry, so it is part of `passed`. */
export interface SuiteReport {
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  exceptions: TestException[];
}

export type TestState = 'passed' | 'failed' | 'skipped';

/** One test as `scripts/ci/vitest-reporter.mts` writes it. */
export interface VitestCiTest {
  file: string;
  title: string;
  state: TestState;
  retries: number;
  error: string;
}

export interface VitestCiReport {
  tests: VitestCiTest[];
}

/** Where Playwright's `file` field starts, because it is relative to the test folder. */
const E2E_ROOT = 'test/e2e';
const MAX_TEXT = 300;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Keeps the first line of an error without terminal colors, so a table cell stays short. */
export function clipError(message: string): string {
  const [first = ''] = stripVTControlCharacters(message).trim().split('\n');
  return first.slice(0, MAX_TEXT);
}

function clipText(text: string): string {
  return text.slice(0, MAX_TEXT);
}

const emptyReport = (): SuiteReport => ({ tests: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, exceptions: [] });

function record(report: SuiteReport, state: TestState, retries: number, exception: Omit<TestException, 'status' | 'retries'>): void {
  report.tests += 1;
  if (state === 'skipped') {
    report.skipped += 1;
    return;
  }
  if (state === 'failed') {
    report.failed += 1;
    report.exceptions.push({ ...exception, status: 'failed', retries });
    return;
  }
  report.passed += 1;
  if (retries > 0) {
    report.flaky += 1;
    report.exceptions.push({ ...exception, status: 'flaky', retries });
  }
}

function isState(value: unknown): value is TestState {
  return value === 'passed' || value === 'failed' || value === 'skipped';
}

/** Counts the tests of a report from `scripts/ci/vitest-reporter.mts`. The file comes from a pull request, so every field is checked. */
export function summarizeVitest(value: unknown): SuiteReport {
  if (!isRecord(value) || !Array.isArray(value['tests'])) {
    throw new Error('The Vitest report has no tests array.');
  }
  const report = emptyReport();
  for (const entry of value['tests']) {
    if (!isRecord(entry) || !isState(entry['state'])) {
      throw new Error('The Vitest report has a test without a valid state.');
    }
    const retries = Number.isSafeInteger(entry['retries']) ? Math.max(0, entry['retries'] as number) : 0;
    record(report, entry['state'], retries, {
      file: clipText(textOf(entry['file'])) || 'unknown',
      title: clipText(textOf(entry['title'])) || 'unknown',
      error: clipError(textOf(entry['error'])) || 'no message',
    });
  }
  return report;
}

function playwrightState(status: unknown): TestState | undefined {
  if (status === 'expected' || status === 'flaky') {
    return 'passed';
  }
  if (status === 'unexpected') {
    return 'failed';
  }
  return status === 'skipped' ? 'skipped' : undefined;
}

/** The error of the first attempt that failed, which is the one a flaky test shows. */
function firstError(results: unknown[]): string {
  for (const result of results) {
    if (isRecord(result) && result['status'] !== 'passed' && isRecord(result['error'])) {
      return clipError(textOf(result['error']['message']));
    }
  }
  return '';
}

function walkSpecs(suite: Json, titles: string[], report: SuiteReport): void {
  for (const spec of listOf(suite['specs'])) {
    if (!isRecord(spec)) {
      continue;
    }
    const title = clipText([...titles, textOf(spec['title'])].join(' > '));
    const file = `${E2E_ROOT}/${clipText(textOf(spec['file']))}`;
    for (const test of listOf(spec['tests'])) {
      const state = isRecord(test) ? playwrightState(test['status']) : undefined;
      if (!isRecord(test) || !state) {
        continue;
      }
      const results = listOf(test['results']);
      record(report, state, Math.max(0, results.length - 1), { file, title, error: firstError(results) || 'no message' });
    }
  }
  for (const child of listOf(suite['suites'])) {
    if (isRecord(child)) {
      walkSpecs(child, [...titles, textOf(child['title'])], report);
    }
  }
}

/** Counts the tests of a Playwright `json` report. The top suites are files, so their titles stay out of the test title. */
export function summarizePlaywright(value: unknown): SuiteReport {
  if (!isRecord(value) || !Array.isArray(value['suites'])) {
    throw new Error('The Playwright report has no suites array.');
  }
  const report = emptyReport();
  for (const file of value['suites']) {
    if (isRecord(file)) {
      walkSpecs(file, [], report);
    }
  }
  return report;
}
