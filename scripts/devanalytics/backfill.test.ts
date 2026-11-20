import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backfill } from './backfill.mts';
import { git, releaseTags } from './git.mts';
import { upload, uploadTarget } from './upload.mts';

vi.mock(import('./git.mts'));
vi.mock(import('./upload.mts'));

const SHA = 'abcdef0123'.repeat(4);
const argv = process.argv;
let output: string;
let outDir: string;

function run(...args: string[]) {
  process.argv = ['node', 'backfill.mts', ...args];
  return backfill({
    name: 'demo',
    route: '/demo/ingest',
    measure: (worktree) => Promise.resolve({ snapshot: { sha: SHA, worktree }, detail: '3 files' }),
  });
}

beforeEach(async () => {
  output = '';
  outDir = await mkdtemp(path.join(os.tmpdir(), 'backfill-test-'));
  vi.spyOn(process.stdout, 'write').mockImplementation((text) => {
    output += String(text);
    return true;
  });
  vi.mocked(uploadTarget).mockReturnValue({ url: 'https://worker.test', token: 't' });
  vi.mocked(upload).mockResolvedValue({ rows: 9 });
});

afterEach(async () => {
  process.argv = argv;
  vi.restoreAllMocks();
  vi.resetAllMocks();
  await rm(outDir, { recursive: true, force: true });
});

describe('backfill', () => {
  it('measures each tag in its own worktree and uploads the snapshot', async () => {
    // Act
    await run('v1.0.0', 'v1.1.0');

    // Assert
    expect(output).toBe(`v1.0.0 abcdef0: 3 files, ingest {"rows":9}\nv1.1.0 abcdef0: 3 files, ingest {"rows":9}\n`);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith({ url: 'https://worker.test', token: 't' }, '/demo/ingest', expect.objectContaining({ sha: SHA }));
  });

  it('adds and removes a detached worktree for each tag, one tag at a time', async () => {
    // Act
    await run('v1.0.0', 'v1.1.0');

    // Assert
    expect(vi.mocked(git).mock.calls).toEqual([
      ['worktree', 'add', '--detach', expect.stringMatching(/v1\.0\.0$/), 'v1.0.0^{commit}'],
      ['worktree', 'remove', '--force', expect.stringMatching(/v1\.0\.0$/)],
      ['worktree', 'add', '--detach', expect.stringMatching(/v1\.1\.0$/), 'v1.1.0^{commit}'],
      ['worktree', 'remove', '--force', expect.stringMatching(/v1\.1\.0$/)],
    ]);
  });

  it('measures every release tag when none is given', async () => {
    // Arrange
    vi.mocked(releaseTags).mockReturnValue(['v0.1.0', 'v0.2.0']);

    // Act
    await run('--dry-run');

    // Assert
    expect(output).toBe('v0.1.0 abcdef0: 3 files, not uploaded\nv0.2.0 abcdef0: 3 files, not uploaded\n');
  });

  it('uploads nothing and asks for no credential on a dry run', async () => {
    // Act
    await run('--dry-run', 'v1.0.0');

    // Assert
    expect(output).toBe('v1.0.0 abcdef0: 3 files, not uploaded\n');
    expect(uploadTarget).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('writes the snapshot of each tag to the out folder', async () => {
    // Arrange
    const dir = path.join(outDir, 'nested');

    // Act
    await run('--dry-run', '--out-dir', dir, 'v1.0.0');

    // Assert
    const written = JSON.parse(await readFile(path.join(dir, 'v1.0.0.json'), 'utf8')) as { sha: string };
    expect(written.sha).toBe(SHA);
  });

  it('skips a tag that the measure gives no snapshot for', async () => {
    // Arrange
    process.argv = ['node', 'backfill.mts', 'v0.0.1'];

    // Act
    await backfill({ name: 'demo', route: '/demo/ingest', measure: () => Promise.resolve(null) });

    // Assert
    expect(output).toBe('v0.0.1: no tests, skipped\n');
    expect(upload).not.toHaveBeenCalled();
  });

  it('removes the worktree and the temporary folder when the measure fails', async () => {
    // Arrange
    let parent = '';
    process.argv = ['node', 'backfill.mts', '--dry-run', 'v1.0.0'];

    // Act
    const act = backfill({
      name: 'demo',
      route: '/demo/ingest',
      measure: (worktree) => {
        parent = path.dirname(worktree);
        return Promise.reject(new Error('install failed'));
      },
    });

    // Assert
    await expect(act).rejects.toThrow('install failed');
    expect(vi.mocked(git).mock.calls.map((call) => call[1])).toEqual(['add', 'remove']);
    await expect(stat(parent)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('names the temporary folder after the kind', async () => {
    // Arrange
    let parent = '';
    process.argv = ['node', 'backfill.mts', '--dry-run', 'v1.0.0'];

    // Act
    await backfill({
      name: 'demo',
      route: '/demo/ingest',
      measure: (worktree) => {
        parent = path.basename(path.dirname(worktree));
        return Promise.resolve(null);
      },
    });

    // Assert
    expect(parent).toMatch(/^demo-backfill-/);
  });
});
