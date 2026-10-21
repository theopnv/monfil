import { readFile } from 'node:fs/promises';
import process from 'node:process';
import type { Snapshot } from './metrics.mts';
import { upload, uploadTarget } from './upload.mts';

const USAGE = 'Usage: npm run complexity:ingest -- <snapshot.json>';

async function main() {
  const [file] = process.argv.slice(2);
  if (!file) {
    throw new Error('Missing snapshot file.');
  }
  const snapshot = JSON.parse(await readFile(file, 'utf8')) as Snapshot;
  const result = await upload(uploadTarget(), snapshot);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
