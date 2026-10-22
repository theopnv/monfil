import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { Stryker } from '@stryker-mutator/core';
import type { MutationTestResult } from 'mutation-testing-report-schema';
import { reportPath, strykerOptions } from './config.mts';
import { falseSurvivors } from './report.mts';
import { MUTATION_SUITES, splitTargets, SUITE_GLOBS, type MutationSuite } from './targets.mts';

const USAGE = [
  'Usage: npm run mutate -- [<path>...] [--all] [--suite unit|integration] [--base <ref>]',
  'Without a path or --all, it mutates the source files that differ from the merge base with --base (default: main).',
  'A path can be a file, a folder or a git pathspec. Reports go to .mutation/<suite>/.',
].join('\n');

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (text: string) => text.split('\n').filter(Boolean);

function changedFiles(base: string): string[] {
  const mergeBase = git('merge-base', 'HEAD', base);
  return [...lines(git('diff', '--name-only', '--diff-filter=d', mergeBase)), ...lines(git('ls-files', '--others', '--exclude-standard'))];
}

function selectedFiles(paths: string[], base: string): string[] {
  if (paths.length === 0) {
    return changedFiles(base);
  }
  return [...lines(git('ls-files', '--', ...paths)), ...lines(git('ls-files', '--others', '--exclude-standard', '--', ...paths))];
}

function targets(values: { all?: boolean; base?: string }, paths: string[]): Record<MutationSuite, string[]> {
  if (values.all) {
    return SUITE_GLOBS;
  }
  return splitTargets(selectedFiles(paths, values.base ?? 'main'));
}

async function mutateSuite(suite: MutationSuite, mutate: string[]): Promise<void> {
  process.stdout.write(`\nMutating ${mutate.length} ${mutate.length === 1 ? 'entry' : 'entries'} with the ${suite} suite.\n`);
  await new Stryker(strykerOptions(suite, mutate)).runMutationTest();
  const report = JSON.parse(await readFile(reportPath(suite, 'json'), 'utf8')) as MutationTestResult;
  const invalid = falseSurvivors(report);
  if (invalid.length > 0) {
    const sample = invalid.slice(0, 5).map(({ file, mutant }) => `  ${file}:${mutant.location.start.line} ${mutant.mutatorName}`);
    throw new Error([`${invalid.length} survivors of the ${suite} suite ran none of the tests that cover them, so the score is wrong.`,
      'Check that patches/ still applies to @stryker-mutator/vitest-runner (stryker-js#6210).', ...sample].join('\n'));
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      all: { type: 'boolean' },
      suite: { type: 'string' },
      base: { type: 'string' },
    },
  });
  if (values.suite !== undefined && !MUTATION_SUITES.includes(values.suite as MutationSuite)) {
    throw new Error(`Unknown suite ${values.suite}.`);
  }
  const selected = targets(values, positionals);
  const suites = MUTATION_SUITES.filter((suite) => (values.suite ?? suite) === suite && selected[suite].length > 0);
  if (suites.length === 0) {
    process.stdout.write('No source file to mutate.\n');
    return;
  }
  for (const suite of suites) {
    await mutateSuite(suite, selected[suite]);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
