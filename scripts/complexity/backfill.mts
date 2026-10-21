import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { snapshot } from './metrics.mts';
import { upload, uploadTarget, type UploadTarget } from './upload.mts';

const USAGE = 'Usage: npm run complexity:backfill -- [--dry-run --out-dir <dir>] [<tag> ...]';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function releaseTags(): string[] {
  return git('tag', '--list', 'v*', '--sort=creatordate').split('\n').filter(Boolean);
}

/** Measures one tag with the current script and toolchain, in a worktree that is always removed. */
async function measureTag(tag: string, parent: string) {
  const worktree = path.join(parent, tag);
  git('worktree', 'add', '--detach', worktree, `${tag}^{commit}`);
  try {
    return await snapshot(worktree);
  } finally {
    git('worktree', 'remove', '--force', worktree);
  }
}

async function handleTag(tag: string, parent: string, target: UploadTarget | null, outDir: string | undefined) {
  const { snapshot: result, warnings } = await measureTag(tag, parent);
  const summary = `${tag} ${result.sha.slice(0, 7)}: ${result.functions.length} functions, ${warnings.length} warnings`;
  if (outDir) {
    await writeFile(path.join(outDir, `${tag}.json`), `${JSON.stringify(result)}\n`);
  }
  if (target) {
    process.stdout.write(`${summary}, ingest ${JSON.stringify(await upload(target, result))}\n`);
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
  const outDir = values['out-dir'];
  if (outDir) {
    await mkdir(outDir, { recursive: true });
  }
  const parent = await mkdtemp(path.join(os.tmpdir(), 'complexity-backfill-'));
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
