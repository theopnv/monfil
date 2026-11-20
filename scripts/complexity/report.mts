import { parseArgs } from 'node:util';
import { readJson, runCli, writeOutput } from '../devanalytics/cli.mts';
import { compareSnapshots, parseDiff, renderMarkdown, type Snapshot } from './compare.mts';

const USAGE = [
  'Usage:',
  '  npm run complexity:report -- compare <base.json> <head.json> [--json] [--out <file>]',
  '  npm run complexity:report -- render <diff.json> [--out <file>]',
].join('\n');

async function run(command: string | undefined, files: string[], json: boolean): Promise<string> {
  if (command === 'compare' && files.length === 2) {
    const [base, head] = await Promise.all(files.map(readJson)) as [Snapshot, Snapshot];
    const diff = compareSnapshots(base, head);
    return json ? `${JSON.stringify(diff, null, 2)}\n` : renderMarkdown(diff);
  }
  if (command === 'render' && files.length === 1) {
    return renderMarkdown(parseDiff(await readJson(files[0] ?? '')));
  }
  throw new Error(`Unknown command: ${[command, ...files].join(' ')}`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      out: { type: 'string' },
    },
  });
  const [command, ...files] = positionals;
  const output = await run(command, files, values.json ?? false);
  await writeOutput(values.out, output);
}

runCli(main, USAGE);
