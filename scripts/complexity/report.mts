import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { compareSnapshots, parseDiff, renderMarkdown, type Snapshot } from './compare.mts';

const USAGE = [
  'Usage:',
  '  npm run complexity:report -- compare <base.json> <head.json> [--json] [--out <file>]',
  '  npm run complexity:report -- render <diff.json> [--out <file>]',
].join('\n');

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

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
  if (values.out) {
    await writeFile(values.out, output);
  } else {
    process.stdout.write(output);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
