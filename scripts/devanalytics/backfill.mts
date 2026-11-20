import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { git, releaseTags } from './git.mts';
import { upload, uploadTarget, type UploadTarget } from './upload.mts';

export interface BackfillKind<T extends { sha: string }> {
  /** Names the temporary folder. */
  name: string;
  /** The ingest route of the Worker. */
  route: string;
  /** Measures a checkout. Returns null to skip the tag. `detail` ends the progress line, for example `12 files`. */
  measure: (worktree: string) => Promise<{ snapshot: T; detail: string } | null>;
}

/** Runs `fn` in a detached worktree of the tag, which is always removed. */
export async function inWorktree<R>(tag: string, parent: string, fn: (worktree: string) => Promise<R>): Promise<R> {
  const worktree = path.join(parent, tag);
  git('worktree', 'add', '--detach', worktree, `${tag}^{commit}`);
  try {
    return await fn(worktree);
  } finally {
    git('worktree', 'remove', '--force', worktree);
  }
}

async function handleTag<T extends { sha: string }>(
  kind: BackfillKind<T>,
  tag: string,
  parent: string,
  target: UploadTarget | null,
  outDir: string | undefined,
) {
  const measured = await inWorktree(tag, parent, kind.measure);
  if (!measured) {
    process.stdout.write(`${tag}: no tests, skipped\n`);
    return;
  }
  const { snapshot, detail } = measured;
  const summary = `${tag} ${snapshot.sha.slice(0, 7)}: ${detail}`;
  if (outDir) {
    await writeFile(path.join(outDir, `${tag}.json`), `${JSON.stringify(snapshot)}\n`);
  }
  if (target) {
    process.stdout.write(`${summary}, ingest ${JSON.stringify(await upload(target, kind.route, snapshot))}\n`);
  } else {
    process.stdout.write(`${summary}, not uploaded\n`);
  }
}

/** Measures each tag given on the command line, or every release tag, and uploads the snapshot unless `--dry-run` is set. */
export async function backfill<T extends { sha: string }>(kind: BackfillKind<T>): Promise<void> {
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
  const parent = await mkdtemp(path.join(os.tmpdir(), `${kind.name}-backfill-`));
  try {
    // One tag at a time keeps a single worktree on disk and one ingest batch in flight.
    for (const tag of tags) {
      await handleTag(kind, tag, parent, target, outDir);
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}
