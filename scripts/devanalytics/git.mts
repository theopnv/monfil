import { execFileSync } from 'node:child_process';

export const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

export function headCommit(root: string): { sha: string; date: string } {
  const [sha = '', date = ''] = git('-C', root, 'show', '-s', '--format=%H%n%cI', 'HEAD').split('\n');
  return { sha, date };
}
