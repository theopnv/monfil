import { describe, expect, it, vi } from 'vitest';
import type { GithubTarget } from './github.mts';
import { parseLogGroups } from './log-groups.mts';
import { loadLogGroups } from './logs.mts';
import type { ApiJob } from './snapshot.mts';

const line = (time: string, text: string) => `2026-11-20T14:${time}Z ${text}`;

const LOG = [
  line('56:04.9759330', '##[group]Runner Image'),
  line('56:04.9779180', '##[endgroup]'),
  line('56:05.1526340', '##[group]Run actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'),
  line('56:05.1600000', 'with:'),
  line('56:06.6667610', '##[group]Fetching the repository'),
  line('56:06.7000000', '[command]git fetch'),
  line('56:08.1258310', '##[group]Run npm ci'),
  line('56:08.2000000', 'added 1200 packages'),
  line('58:27.1714120', '##[group]Run node node_modules/electron/install.js'),
  line('58:31.0348920', '##[endgroup]'),
  line('58:35.0348920', 'Done'),
].join('\n');

describe('parseLogGroups', () => {
  it('measures each group up to the next group, and the last one up to the end of the log', () => {
    // Act
    const groups = parseLogGroups(LOG);

    // Assert
    expect(groups).toEqual([
      { name: 'Run actions/checkout', duration_ms: 1514 },
      { name: 'Fetching the repository', duration_ms: 1459 },
      { name: 'Run npm ci', duration_ms: 139_046 },
      { name: 'Run node node_modules/electron/install.js', duration_ms: 7_863 },
    ]);
  });

  it('drops the groups that are shorter than the minimum', () => {
    // Act
    const names = parseLogGroups(LOG).map((group) => group.name);

    // Assert
    expect(names).not.toContain('Runner Image');
  });

  it('keeps shorter groups when the minimum is lower', () => {
    // Act
    const groups = parseLogGroups(LOG, 0);

    // Assert
    expect(groups.map((group) => group.name)).toContain('Runner Image');
  });

  it('reads a log with carriage returns, a byte order mark and a timestamp without a fraction', () => {
    // Arrange
    const log = `\uFEFF2026-11-20T14:00:00Z ##[group]Run first\r\n2026-11-20T14:00:03Z ##[group]Run second\r\n2026-11-20T14:00:05Z done\r\n`;

    // Act
    const groups = parseLogGroups(log);

    // Assert
    expect(groups).toEqual([{ name: 'Run first', duration_ms: 3000 }, { name: 'Run second', duration_ms: 2000 }]);
  });

  it('ignores a line without a timestamp and a group without a name', () => {
    // Arrange
    const log = ['##[group]Run no timestamp', line('00:00.000', '##[group]'), line('00:05.000', 'end')].join('\n');

    // Act
    const groups = parseLogGroups(log);

    // Assert
    expect(groups).toEqual([]);
  });

  it('returns no group for text that is not a log', () => {
    // Act
    const groups = parseLogGroups('Not Found');

    // Assert
    expect(groups).toEqual([]);
  });

  it('removes terminal colors from a name and caps the number of groups', () => {
    // Arrange
    const many = Array.from({ length: 300 }, (_, index) => line(`${String(Math.floor(index / 30)).padStart(2, '0')}:${String((index % 30) * 2).padStart(2, '0')}.000`, `##[group]\u001b[1mgroup ${index}\u001b[22m`));

    // Act
    const groups = parseLogGroups(many.join('\n'), 0);

    // Assert
    expect(groups).toHaveLength(200);
    expect(groups[0]?.name).toBe('group 0');
  });
});

describe('loadLogGroups', () => {
  const target: GithubTarget = { apiUrl: 'https://api.test', repository: 'o/r', token: 't' };
  const job = (id: number, started: string | null): ApiJob => ({
    id,
    name: `job ${id}`,
    conclusion: 'success',
    created_at: '2026-11-20T14:00:00Z',
    started_at: started,
    completed_at: null,
    labels: [],
  });

  it('reads the log of each job that started and skips the others', async () => {
    // Arrange
    const readLog = vi.fn(async () => LOG);

    // Act
    const groups = await loadLogGroups(target, [job(1, '2026-11-20T14:00:00Z'), job(2, null)], vi.fn(), readLog);

    // Assert
    expect([...groups.keys()]).toEqual([1]);
    expect(readLog).toHaveBeenCalledTimes(1);
  });

  it('warns about a log that cannot be read and keeps the others', async () => {
    // Arrange
    const readLog = vi.fn(async (_target: GithubTarget, id: number) => {
      if (id === 1) {
        throw new Error('GitHub answered 404');
      }
      return LOG;
    });
    const warn = vi.fn();

    // Act
    const groups = await loadLogGroups(target, [job(1, 'x'), job(2, 'x')], warn, readLog);

    // Assert
    expect([...groups.keys()]).toEqual([2]);
    expect(warn).toHaveBeenCalledWith('Skipped the log of job job 1: GitHub answered 404');
  });
});
