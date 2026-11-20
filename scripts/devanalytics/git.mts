import { execFileSync } from 'node:child_process';

export const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

export function releaseTags(root = '.'): string[] {
  return git('-C', root, 'tag', '--list', 'v*', '--sort=creatordate').split('\n').filter(Boolean);
}

export function headCommit(root: string): { sha: string; date: string } {
  const [sha = '', date = ''] = git('-C', root, 'show', '-s', '--format=%H%n%cI', 'HEAD').split('\n');
  return { sha, date };
}
