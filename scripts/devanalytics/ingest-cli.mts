import process from 'node:process';
import { readJson, runCli } from './cli.mts';
import { upload, uploadTarget } from './upload.mts';

const USAGE = 'Usage: node scripts/devanalytics/ingest-cli.mts <route> <snapshot.json>, for example /complexity/ingest.';

async function main() {
  const [route, file] = process.argv.slice(2);
  if (!route || !file) {
    throw new Error('Missing route or snapshot file.');
  }
  const snapshot = await readJson(file) as { sha: string };
  const result = await upload(uploadTarget(), route, snapshot);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

runCli(main, USAGE);
