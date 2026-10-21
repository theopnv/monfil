import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { upload, uploadTarget } from '../devanalytics/upload.mts';
import type { Snapshot } from './maps.mts';

const USAGE = 'Usage: npm run coverage:ingest -- <snapshot.json>';

async function main() {
  const [file] = process.argv.slice(2);
  if (!file) {
    throw new Error('Missing snapshot file.');
  }
  const snapshot = JSON.parse(await readFile(file, 'utf8')) as Snapshot;
  const result = await upload(uploadTarget(), '/coverage/ingest', snapshot);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
