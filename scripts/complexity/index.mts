import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { snapshot } from './metrics.mts';

const USAGE = 'Usage: npm run complexity -- [--root <checkout>] [--out <snapshot.json>]';

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
  const { snapshot: result, warnings } = await snapshot(root);
  for (const warning of warnings) {
    process.stderr.write(`warning: ${warning}\n`);
  }
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (values.out) {
    await writeFile(values.out, json);
    process.stderr.write(`Wrote ${result.functions.length} functions to ${values.out}\n`);
  } else {
    process.stdout.write(json);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
