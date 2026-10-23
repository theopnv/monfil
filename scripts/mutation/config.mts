import path from 'node:path';
import type { PartialStrykerOptions } from '@stryker-mutator/api/core';
import type { MutationSuite } from './targets.mts';

export const OUTPUT_DIR = '.mutation';

const VITEST_CONFIG: Record<MutationSuite, string> = {
  unit: 'vitest.node.config.mts',
  integration: 'vitest.browser.config.mts',
};

/** Each Chromium page takes far more memory than a Node worker, and the browser suite already runs its files one at a time. */
const CONCURRENCY: Partial<Record<MutationSuite, number>> = { integration: 2 };

export function reportPath(suite: MutationSuite, extension: 'json' | 'html'): string {
  return path.join(OUTPUT_DIR, suite, `mutation.${extension}`);
}

/** The options of one Stryker run. `mutate` takes files or globs, relative to the repository root. */
export function strykerOptions(suite: MutationSuite, mutate: string[]): PartialStrykerOptions {
  return {
    testRunner: 'vitest',
    vitest: { configFile: VITEST_CONFIG[suite], related: false },
    checkers: ['typescript'],
    tsconfigFile: 'tsconfig.json',
    typescriptChecker: { prioritizePerformanceOverAccuracy: true },
    plugins: ['@stryker-mutator/*', path.resolve(import.meta.dirname, 'ignore-logger.mts')],
    ignorers: ['logger'],
    mutate,
    // The sandbox gets only what the tests and the type check read, so it skips the docs, the Worker and local symlinks.
    ignorePatterns: ['/*', '!/src', '!/feedpacks', '!/package.json', '!/tsconfig*.json', '!/vitest.*.mts', '!/forge.env.d.ts', '!/index.html'],
    coverageAnalysis: 'perTest',
    // A static mutant runs every test of the suite, which doubles a full run for less than one point of score.
    ignoreStatic: true,
    // Every covering test runs, so the report lists all the tests that kill a mutant and shows which tests kill nothing.
    disableBail: true,
    thresholds: { high: 80, low: 60, break: null },
    reporters: ['clear-text', 'progress', 'json', 'html'],
    jsonReporter: { fileName: reportPath(suite, 'json') },
    htmlReporter: { fileName: reportPath(suite, 'html') },
    clearTextReporter: { allowEmojis: false, logTests: false, reportTests: false, reportMutants: false },
    tempDirName: '.stryker-tmp',
    cleanTempDir: 'always',
    // A linked node_modules would share the Vitest module cache with the repository, and each side clears it for the other because they hash the lockfile differently.
    symlinkNodeModules: false,
    ...(CONCURRENCY[suite] && { concurrency: CONCURRENCY[suite] }),
  };
}
