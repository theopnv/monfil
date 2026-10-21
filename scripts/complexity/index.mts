import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { collect } from './metrics.mts';

const USAGE = 'Usage: npm run complexity -- [--root <checkout>] [--out <snapshot.json>]';

function commit(root: string) {
  const [sha, date] = execFileSync('git', ['-C', root, 'show', '-s', '--format=%H%n%cI', 'HEAD'], { encoding: 'utf8' })
    .trim()
    .split('\n');
  return { sha, date };
}

async function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const root = path.resolve(values.root ?? process.cwd());
  const { records, warnings } = await collect(root);
  for (const warning of warnings) {
    process.stderr.write(`warning: ${warning}\n`);
  }
  const json = `${JSON.stringify({ ...commit(root), functions: records }, null, 2)}\n`;
  if (values.out) {
    await writeFile(values.out, json);
    process.stderr.write(`Wrote ${records.length} functions to ${values.out}\n`);
  } else {
    process.stdout.write(json);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
