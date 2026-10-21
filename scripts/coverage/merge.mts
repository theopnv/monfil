import { readFileSync } from 'node:fs';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import { headCommit } from '../complexity/metrics.mts';
import { buildSuites, loadE2eMap, loadVitestMap, mergeMaps, total, type Snapshot } from './maps.mts';

const USAGE = 'Usage: npm run coverage:merge -- [--root <checkout>] [--vitest <coverage-final.json> ...] [--e2e <dir>] [--out <dir>]';

async function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      vitest: { type: 'string', multiple: true },
      e2e: { type: 'string' },
      out: { type: 'string' },
    },
  });
  // Coverage paths are real paths, and a temporary folder can sit behind a symlink.
  const root = await realpath(path.resolve(values.root ?? process.cwd()));
  const out = path.resolve(root, values.out ?? 'coverage');
  const vitestFiles = values.vitest ?? ['.vitest/coverage/coverage-final.json'];
  const vitest = mergeMaps(...await Promise.all(vitestFiles.map((file) => loadVitestMap(path.resolve(root, file), root))));
  const { map: e2e, fileCount } = await loadE2eMap(path.resolve(root, values.e2e ?? 'coverage/e2e/raw'), root);
  process.stderr.write(`Read ${fileCount} e2e coverage files.\n`);
  if (fileCount === 0) {
    throw new Error('No e2e coverage files. Run the e2e suite with COVERAGE=1.');
  }

  const { mergedMap, ...suites } = buildSuites(vitest, e2e);
  const snapshot: Snapshot = { ...headCommit(root), suites };
  await mkdir(path.join(out, 'merged'), { recursive: true });
  const context = libReport.createContext({
    dir: path.join(out, 'merged'),
    coverageMap: mergedMap,
    defaultSummarizer: 'nested',
    sourceFinder: (file: string) => readFileSync(path.resolve(root, file), 'utf8'),
  });
  for (const name of ['html', 'json-summary'] as const) {
    reports.create(name).execute(context);
  }
  await writeFile(path.join(out, 'snapshot.json'), `${JSON.stringify(snapshot)}\n`);
  for (const [name, files] of Object.entries(suites)) {
    const [covered, lines] = total(files, 'lines');
    process.stderr.write(`${name}: ${files.length} files, lines ${covered}/${lines}\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
