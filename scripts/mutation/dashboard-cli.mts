import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { reportPath } from './config.mts';
import { uploadReport } from './dashboard.mts';
import { MUTATION_SUITES } from './targets.mts';

const USAGE = [
  'Usage: npm run mutate:upload -- [--version <name>] [--suite unit|integration]',
  'Sends the last report of each suite in .mutation/ to the Stryker dashboard. The version defaults to the current branch.',
  'Set STRYKER_DASHBOARD_API_KEY in the environment or in .env.',
].join('\n');

async function main() {
  const { values } = parseArgs({ options: { version: { type: 'string' }, suite: { type: 'string' } } });
  const apiKey = process.env['STRYKER_DASHBOARD_API_KEY'];
  if (!apiKey) {
    throw new Error('Missing STRYKER_DASHBOARD_API_KEY.');
  }
  const version = values.version ?? execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  if (!version) {
    throw new Error('No current branch. Pass --version.');
  }
  const suites = MUTATION_SUITES.filter((suite) => (values.suite ?? suite) === suite);
  for (const suite of suites) {
    const report = await readFile(reportPath(suite, 'json'), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    });
    if (report === null) {
      process.stdout.write(`No ${suite} report to send.\n`);
      continue;
    }
    process.stdout.write(`${suite}: ${await uploadReport(report, version, suite, apiKey)}\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
