import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { upload, uploadTarget, type UploadTarget } from '../devanalytics/upload.mts';
import type { Snapshot } from './maps.mts';
import { forgeViteConfigs, originalName, wrapperSource } from './overlay.mts';
import { EXCLUDE, INCLUDE } from './vite-plugins.mts';

const USAGE = 'Usage: npm run coverage:backfill -- [--dry-run] [--out-dir <dir>] [<tag> ...]';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VITEST_CONFIGS = ['vitest.config.mts', 'vitest.browser.config.mts'];

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function releaseTags(): string[] {
  return git('tag', '--list', 'v*', '--sort=creatordate').split('\n').filter(Boolean);
}

/** Runs a command and returns whether it succeeded. A failed test run is not a failed tag. */
function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): boolean {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  if (result.error) {
    throw result.error;
  }
  return result.status === 0;
}

function must(ok: boolean, what: string): void {
  if (!ok) {
    throw new Error(`${what} failed.`);
  }
}

async function installedVersion(worktree: string, name: string): Promise<string> {
  const manifest = JSON.parse(await readFile(path.join(worktree, 'node_modules', name, 'package.json'), 'utf8')) as { version: string };
  return manifest.version;
}

async function install(worktree: string): Promise<void> {
  // The lock file of v0.0.2 has a git dependency, which npm 12 refuses unless it is allowed.
  const env = { npm_config_allow_git: 'all' };
  must(run('npm', ['ci'], worktree, env), 'npm ci');
  const vitest = await installedVersion(worktree, 'vitest');
  must(run('npm', ['install', '--no-save', `@vitest/coverage-istanbul@${vitest}`, 'istanbul-lib-instrument@6'], worktree, env), 'npm install');
  // Each tag pins its own Playwright, which needs the matching browser build.
  must(run('npx', ['playwright', 'install', 'chromium', '--only-shell'], worktree), 'playwright install');
}

/** Copies the current plugins into the checkout and wraps each of its Vite configs with them. */
async function overlay(worktree: string): Promise<void> {
  const target = path.join(worktree, 'scripts', 'coverage');
  await mkdir(target, { recursive: true });
  for (const name of ['vite-plugins.mts', 'dump.mts']) {
    await cp(path.join(REPO, 'scripts', 'coverage', name), path.join(target, name));
  }
  const forge = await readFile(path.join(worktree, 'forge.config.ts'), 'utf8');
  const configs = forgeViteConfigs(forge);
  if (configs.length === 0) {
    throw new Error('forge.config.ts names no Vite config.');
  }
  for (const { file, target: kind } of configs) {
    const original = path.join(worktree, file);
    await rename(original, originalName(original));
    await writeFile(original, wrapperSource(original, path.join(target, 'vite-plugins.mts'), kind));
  }
}

type Scope = 'node' | 'browser' | 'all';

// Uncovered files are transformed in the environment of the run, so the browser run must not reach Node-only code such as the preload script.
function coverageFlags(dir: string, scope: Scope): string[] {
  const include = scope === 'browser' ? ['src/renderer/**/*.{ts,tsx}'] : INCLUDE;
  const exclude = scope === 'node' ? [...EXCLUDE, 'src/renderer/**'] : EXCLUDE;
  return [
    '--coverage.enabled',
    '--coverage.provider=istanbul',
    '--coverage.reporter=json',
    `--coverage.reportsDirectory=${dir}`,
    '--coverage.reportOnFailure',
    ...include.map((pattern) => `--coverage.include=${pattern}`),
    ...exclude.map((pattern) => `--coverage.exclude=${pattern}`),
  ];
}

function mustExist(file: string, what: string): string {
  if (!existsSync(file)) {
    throw new Error(`${what} wrote no ${file}.`);
  }
  return file;
}

/** Runs the tag's Node and browser Vitest configs one at a time. A tag with `test.projects` runs once. */
async function runVitest(worktree: string): Promise<{ coverage: string[]; results: string[] }> {
  const configs = VITEST_CONFIGS.filter((name) => existsSync(path.join(worktree, name)));
  const rootText = configs[0] ? await readFile(path.join(worktree, configs[0]), 'utf8') : '';
  const hasProjects = /\bprojects\s*:/.test(rootText);
  const selected = hasProjects ? configs.slice(0, 1) : configs;
  const files = { coverage: [] as string[], results: [] as string[] };
  for (const config of selected) {
    const dir = path.join(worktree, 'coverage', 'vitest', config.replace(/\.mts$/, ''));
    const scope: Scope = hasProjects ? 'all' : config.includes('browser') ? 'browser' : 'node';
    const results = path.join(worktree, 'coverage', 'tests', `${path.basename(dir)}.json`);
    const reporters = ['--reporter=default', '--reporter=json', `--outputFile.json=${results}`];
    const ok = run('npx', ['vitest', 'run', `--config=${config}`, ...coverageFlags(dir, scope), ...reporters], worktree);
    files.coverage.push(mustExist(path.join(dir, 'coverage-final.json'), config));
    files.results.push(mustExist(results, config));
    if (!ok) {
      process.stderr.write(`warning: ${config} has failing tests. The coverage of the tests that ran still counts.\n`);
    }
  }
  return files;
}

function runE2e(worktree: string): { dir: string; results: string } {
  const dir = path.join(worktree, 'coverage', 'e2e', 'raw');
  const results = path.join(worktree, 'coverage', 'tests', 'e2e.json');
  const env = { COVERAGE: '1', COVERAGE_DIR: dir, PLAYWRIGHT_JSON_OUTPUT_FILE: results };
  const ok = run('npm', ['run', 'test:e2e', '--', '--reporter=dot,json'], worktree, env);
  mustExist(dir, 'The e2e suite');
  mustExist(results, 'The e2e suite');
  if (!ok) {
    process.stderr.write('warning: the e2e suite has failing tests. The coverage of the tests that ran still counts.\n');
  }
  return { dir, results };
}

/** Measures one tag with the current coverage tooling, in a worktree that is always removed. */
async function measureTag(tag: string, parent: string): Promise<Snapshot | null> {
  const worktree = path.join(parent, tag);
  git('worktree', 'add', '--detach', worktree, `${tag}^{commit}`);
  try {
    if (!existsSync(path.join(worktree, 'playwright.config.ts')) && !existsSync(path.join(worktree, 'vitest.config.mts'))) {
      return null;
    }
    await install(worktree);
    await overlay(worktree);
    // The e2e build writes routeTree.gen.ts, which the renderer files need when Vitest transforms them.
    const e2e = runE2e(worktree);
    const vitest = await runVitest(worktree);
    const merge = path.join(REPO, 'scripts', 'coverage', 'merge.mts');
    const args = [
      '--root', worktree,
      ...vitest.coverage.flatMap((file) => ['--vitest', file]),
      ...vitest.results.flatMap((file) => ['--vitest-results', file]),
      '--e2e', e2e.dir,
      '--e2e-results', e2e.results,
    ];
    must(run(process.execPath, [merge, ...args], worktree), 'merge');
    return JSON.parse(await readFile(path.join(worktree, 'coverage', 'snapshot.json'), 'utf8')) as Snapshot;
  } finally {
    git('worktree', 'remove', '--force', worktree);
  }
}

async function handleTag(tag: string, parent: string, target: UploadTarget | null, outDir: string | undefined) {
  const snapshot = await measureTag(tag, parent);
  if (!snapshot) {
    process.stdout.write(`${tag}: no tests, skipped\n`);
    return;
  }
  const summary = `${tag} ${snapshot.sha.slice(0, 7)}: ${snapshot.suites.merged.length} files`;
  if (outDir) {
    await writeFile(path.join(outDir, `${tag}.json`), `${JSON.stringify(snapshot)}\n`);
  }
  if (target) {
    process.stdout.write(`${summary}, ingest ${JSON.stringify(await upload(target, '/coverage/ingest', snapshot))}\n`);
  } else {
    process.stdout.write(`${summary}, not uploaded\n`);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      'out-dir': { type: 'string' },
    },
  });
  const tags = positionals.length > 0 ? positionals : releaseTags();
  const target = values['dry-run'] ? null : uploadTarget();
  const outDir = values['out-dir'] ? path.resolve(values['out-dir']) : undefined;
  if (outDir) {
    await mkdir(outDir, { recursive: true });
  }
  const parent = await mkdtemp(path.join(os.tmpdir(), 'coverage-backfill-'));
  try {
    // One tag at a time keeps a single worktree on disk and one ingest batch in flight.
    for (const tag of tags) {
      await handleTag(tag, parent, target, outDir);
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
  process.exitCode = 1;
});
