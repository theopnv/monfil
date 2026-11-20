import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { TestState, VitestCiReport, VitestCiTest } from './test-report.mts';

/** The parts of Vitest's `TestCase` that the report reads. */
export interface TestCaseLike {
  fullName: string;
  module: { moduleId: string };
  result: () => { state: string; errors?: readonly { message?: string }[] };
  diagnostic: () => { retryCount: number } | undefined;
  attempts: () => readonly { state: string; errors?: readonly { message?: string }[] }[];
}

export interface TestModuleLike {
  children: { allTests: () => Iterable<TestCaseLike> };
}

function stateOf(state: string): TestState {
  return state === 'passed' || state === 'failed' ? state : 'skipped';
}

/** A flaky test passed in the end, so its message comes from the first attempt that failed. */
function errorOf(test: TestCaseLike, state: TestState): string {
  const failed = state === 'failed' ? test.result() : test.attempts().find((attempt) => attempt.state === 'failed');
  return failed?.errors?.[0]?.message ?? '';
}

export function toReport(modules: Iterable<TestModuleLike>, root: string): VitestCiReport {
  const tests: VitestCiTest[] = [];
  for (const module of modules) {
    for (const test of module.children.allTests()) {
      const state = stateOf(test.result().state);
      tests.push({
        file: path.relative(root, test.module.moduleId).split(path.sep).join('/'),
        title: test.fullName,
        state,
        retries: test.diagnostic()?.retryCount ?? 0,
        error: errorOf(test, state),
      });
    }
  }
  return { tests };
}

/**
 * A Vitest reporter for CI. Vitest's own `json` reporter does not say which test passed on a retry.
 * It writes to the file in `MONFIL_CI_REPORT` and does nothing when that is unset.
 */
export default class CiReporter {
  onTestRunEnd(modules: ReadonlyArray<TestModuleLike>): void {
    const file = process.env['MONFIL_CI_REPORT'];
    if (!file) {
      return;
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(toReport(modules, process.cwd())));
  }
}
