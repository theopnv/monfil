import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function stateOf(state) {
  return state === 'passed' || state === 'failed' ? state : 'skipped';
}

/** A flaky test passed in the end, so its message comes from the first attempt that failed. */
function errorOf(test, state) {
  const failed = state === 'failed' ? test.result() : test.attempts().find((attempt) => attempt.state === 'failed');
  return failed?.errors?.[0]?.message ?? '';
}

export function toReport(modules, root) {
  const tests = [];
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
 * A Vitest reporter for CI. The `json` reporter of Vitest does not say which test passed on a retry.
 * It writes to the file in `DEVANALYTICS_VITEST_REPORT` and does nothing when that is unset.
 */
export default class DevanalyticsReporter {
  onTestRunEnd(modules) {
    const file = process.env['DEVANALYTICS_VITEST_REPORT'];
    if (!file) {
      return;
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(toReport(modules, process.cwd())));
  }
}
