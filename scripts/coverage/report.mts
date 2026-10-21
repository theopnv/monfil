import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { compareSnapshots, parseDiff, parseSnapshot, renderMarkdown, snapshotFromRows } from './compare.mts';

const USAGE = [
  'Usage:',
  '  npm run coverage:report -- compare <base-rows.json> <head.json> --merge-base <sha> [--changed <list.txt>] [--json] [--out <file>]',
  '  npm run coverage:report -- render <diff.json> [--out <file>]',
  'base-rows.json is the response of POST /coverage/query for the rows of one sha. Use {"rows":[]} when there is none.',
].join('\n');

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readLines(file: string | undefined): Promise<string[]> {
  return file ? (await readFile(file, 'utf8')).split('\n').map((line) => line.trim()).filter(Boolean) : [];
}

async function compare(files: string[], values: { 'merge-base'?: string; changed?: string }) {
  const [baseFile = '', headFile = ''] = files;
  const mergeBaseSha = values['merge-base'];
  if (!mergeBaseSha) {
    throw new Error('Missing --merge-base.');
  }
  const base = snapshotFromRows(await readJson(baseFile));
  const head = parseSnapshot(await readJson(headFile));
  return compareSnapshots(base, head, { mergeBaseSha, changedFiles: await readLines(values.changed) });
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'merge-base': { type: 'string' },
      changed: { type: 'string' },
      json: { type: 'boolean' },
      out: { type: 'string' },
    },
  });
  const [command, ...files] = positionals;
  let output: string;
  if (command === 'compare' && files.length === 2) {
    const diff = await compare(files, values);
    output = values.json ? `${JSON.stringify(diff, null, 2)}\n` : renderMarkdown(diff);
  } else if (command === 'render' && files.length === 1) {
    output = renderMarkdown(parseDiff(await readJson(files[0] ?? '')));
  } else {
    throw new Error(`Unknown command: ${[command, ...files].join(' ')}`);
  }
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
