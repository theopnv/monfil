import process from 'node:process';
import { parseArgs } from 'node:util';
import { runCli, writeOutput } from '../devanalytics/cli.mts';
import { fetchJobs, fetchRun, githubTarget } from './github.mts';
import { loadLogGroups } from './logs.mts';
import { loadReports } from './reports.mts';
import { buildSnapshot } from './snapshot.mts';

const USAGE = 'Usage: node scripts/ci/collect.mts --run-id <id> --attempt <n> --reports <folder> [--out <snapshot.json>]';

function positiveInteger(value: string | undefined, name: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return number;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
      'attempt': { type: 'string' },
      'reports': { type: 'string' },
      'out': { type: 'string' },
    },
  });
  const runId = positiveInteger(values['run-id'], '--run-id');
  const attempt = positiveInteger(values['attempt'], '--attempt');
  if (!values['reports']) {
    throw new Error('Missing --reports.');
  }
  const target = githubTarget();
  const warn = (message: string) => process.stdout.write(`::warning::${message}\n`);
  const [run, jobs, results] = await Promise.all([
    fetchRun(target, runId, attempt),
    fetchJobs(target, runId, attempt),
    loadReports(values['reports'], attempt, warn),
  ]);
  const groups = await loadLogGroups(target, jobs, warn);
  await writeOutput(values['out'], `${JSON.stringify(buildSnapshot(run, jobs, results, groups))}\n`);
}

runCli(main, USAGE);
