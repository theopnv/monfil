import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import type { MutationTestResult } from 'mutation-testing-report-schema';
import { OUTPUT_DIR, reportPath } from './config.mts';
import { MUTATION_SUITES } from './targets.mts';
import { narrowReport, renderWorklist } from './worklist.mts';

const USAGE = [
  'Usage: npm run mutate:worklist -- [<path>...] [--out <file>]',
  'Reads the last report of each suite in .mutation/ and writes the work list (default: .mutation/worklist.md).',
  'A path keeps only the mutated files under it.',
].join('\n');

async function readReport(file: string): Promise<MutationTestResult | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as MutationTestResult;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
  const sections: string[] = [];
  for (const suite of MUTATION_SUITES) {
    const report = await readReport(reportPath(suite, 'json'));
    if (report) {
      sections.push(renderWorklist(suite, narrowReport(report, positionals)));
    }
  }
  if (sections.length === 0) {
    throw new Error('No report in .mutation/. Run npm run mutate first.');
  }
  const out = values.out ?? path.join(OUTPUT_DIR, 'worklist.md');
  await writeFile(out, ['# Mutation work list', '', ...sections].join('\n'));
  process.stdout.write(`Wrote ${out}.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
