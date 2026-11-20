import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { headCommit, releaseTags } from './git.mts';

let repo: string;

function commit(date: string, ...tags: string[]): string {
  const env = { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date };
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'commit.gpgsign=false', ...args], { env, encoding: 'utf8' });
  git('commit', '--allow-empty', '-q', '-m', 'x');
  for (const tag of tags) {
    git('tag', tag);
  }
  return git('rev-parse', 'HEAD').trim();
}

beforeEach(async () => {
  repo = await mkdtemp(path.join(os.tmpdir(), 'git-test-'));
  execFileSync('git', ['-C', repo, 'init', '-q']);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('headCommit', () => {
  it('gives the sha and the commit date of HEAD', () => {
    // Arrange
    commit('2026-01-01T00:00:00Z');
    const sha = commit('2026-01-02T03:04:05Z');

    // Act
    const result = headCommit(repo);

    // Assert
    expect(result).toEqual({ sha, date: '2026-01-02T03:04:05Z' });
  });
});

describe('releaseTags', () => {
  it('lists the release tags by creation date, not by name', () => {
    // Arrange
    commit('2026-01-01T00:00:00Z', 'v0.2.0', 'not-a-release');
    commit('2026-01-02T00:00:00Z', 'v0.1.0');

    // Act
    const result = releaseTags(repo);

    // Assert
    expect(result).toEqual(['v0.2.0', 'v0.1.0']);
  });

  it('gives an empty list when there is no release tag', () => {
    // Arrange
    commit('2026-01-01T00:00:00Z', 'draft');

    // Act
    const result = releaseTags(repo);

    // Assert
    expect(result).toEqual([]);
  });
});
