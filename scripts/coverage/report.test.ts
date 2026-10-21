import { describe, expect, it } from 'vitest';
import { compareSnapshots, parseDiff, parseSnapshot, renderMarkdown, snapshotFromRows, MARKER } from './compare.mts';
import type { FileSummary, Snapshot } from './maps.mts';

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const MERGE_BASE = 'c'.repeat(40);

function file(name: string, covered: number, total: number): FileSummary {
  return { file: name, lines: [covered, total], statements: [covered, total], functions: [covered, total], branches: [covered, total] };
}

function snapshot(sha: string, files: FileSummary[]): Snapshot {
  return { sha, date: '2026-10-21T00:00:00Z', suites: { vitest: files, e2e: files, merged: files } };
}

describe('compareSnapshots', () => {
  it('sums the suites, and lists only the changed files of the head run, the least covered first', () => {
    // Arrange
    const base = snapshot(BASE, [file('src/a.ts', 5, 10), file('src/b.ts', 10, 10)]);
    const head = snapshot(HEAD, [file('src/a.ts', 8, 10), file('src/b.ts', 10, 10), file('src/c.ts', 1, 10)]);

    // Act
    const diff = compareSnapshots(base, head, { mergeBaseSha: BASE, changedFiles: ['src/a.ts', 'src/c.ts', 'README.md'] });

    // Assert
    expect(diff.suites.merged.lines).toEqual({ base: [15, 20], head: [19, 30] });
    expect(diff.files).toEqual([
      { file: 'src/c.ts', lines: [1, 10], base_lines: null },
      { file: 'src/a.ts', lines: [8, 10], base_lines: [5, 10] },
    ]);
  });

  it('has no base totals when the database has no row', () => {
    // Act
    const diff = compareSnapshots(null, snapshot(HEAD, [file('src/a.ts', 1, 2)]), { mergeBaseSha: MERGE_BASE, changedFiles: [] });

    // Assert
    expect(diff.base_sha).toBeNull();
    expect(diff.suites.vitest.lines.base).toBeNull();
  });
});

describe('snapshotFromRows', () => {
  const row = { sha: BASE, date: '2026-10-20T00:00:00.000Z', suite: 'merged', file: 'src/a.ts', lines_covered: 1, lines_total: 2, statements_covered: 1,
    statements_total: 2, functions_covered: 0, functions_total: 1, branches_covered: 0, branches_total: 0 };

  it('groups the rows by suite', () => {
    // Act
    const result = snapshotFromRows({ rows: [row, { ...row, suite: 'e2e' }] });

    // Assert
    expect(result?.sha).toBe(BASE);
    expect(result?.suites.merged).toEqual([file('src/a.ts', 1, 2)].map((f) => ({ ...f, functions: [0, 1], branches: [0, 0] })));
    expect(result?.suites.e2e).toHaveLength(1);
    expect(result?.suites.vitest).toEqual([]);
  });

  it('gives null when there are no rows', () => {
    // Act
    const result = snapshotFromRows({ rows: [] });

    // Assert
    expect(result).toBeNull();
  });

  it('refuses a row with an unknown suite', () => {
    // Act
    const parse = () => snapshotFromRows({ rows: [{ ...row, suite: 'other' }] });

    // Assert
    expect(parse).toThrow('suite');
  });
});

describe('parseSnapshot', () => {
  it.each([
    ['a covered count above the total', { lines: [3, 2] }],
    ['a count that is not finite', { lines: [Number.NaN, 2] }],
    ['a count that is a string', { lines: ['1', '2'] }],
  ])('refuses %s', (_label, override) => {
    // Arrange
    const body = snapshot(HEAD, [{ ...file('src/a.ts', 1, 2), ...override } as unknown as FileSummary]);

    // Act
    const parse = () => parseSnapshot(JSON.parse(JSON.stringify(body)));

    // Assert
    expect(parse).toThrow();
  });

  it('keeps only the known fields', () => {
    // Arrange
    const body = { ...snapshot(HEAD, [file('src/a.ts', 1, 2)]), extra: 'x' };

    // Act
    const result = parseSnapshot(body);

    // Assert
    expect(result).not.toHaveProperty('extra');
  });
});

describe('renderMarkdown', () => {
  const diff = compareSnapshots(
    snapshot(BASE, [file('src/a.ts', 5, 10)]),
    snapshot(HEAD, [file('src/a.ts', 8, 10), file('src/`x`|[link](http://evil.test).ts', 0, 4)]),
    { mergeBaseSha: BASE, changedFiles: ['src/a.ts', 'src/`x`|[link](http://evil.test).ts'] },
  );

  it('starts with the marker and shows the delta of each suite in percentage points', () => {
    // Act
    const result = renderMarkdown(diff);

    // Assert
    expect(result.startsWith(MARKER)).toBe(true);
    expect(result).toContain('| Merged | 57.1% (+7.1) · 8/14 |');
  });

  it('puts every path in a code span with no pipe, so that no link or cell break survives', () => {
    // Act
    const result = renderMarkdown(diff);

    // Assert
    const row = result.split('\n').find((line) => line.includes('evil.test'));
    expect(row).toBe('| `` src/`x`∣[link](http://evil.test).ts `` | 0.0% · 0/4 (new) |');
  });

  it('says so when there is no stored base', () => {
    // Arrange
    const noBase = compareSnapshots(null, snapshot(HEAD, [file('src/a.ts', 1, 2)]), { mergeBaseSha: MERGE_BASE, changedFiles: ['src/a.ts'] });

    // Act
    const result = renderMarkdown(noBase);

    // Assert
    expect(result).toContain('No stored coverage to compare');
    expect(result).not.toContain('(+');
    expect(result).not.toContain('(new)');
  });

  it('says which commit it falls back to when the merge base has no row', () => {
    // Arrange
    const fallback = compareSnapshots(snapshot(BASE, [file('src/a.ts', 1, 2)]), snapshot(HEAD, [file('src/a.ts', 1, 2)]), { mergeBaseSha: MERGE_BASE, changedFiles: [] });

    // Act
    const result = renderMarkdown(fallback);

    // Assert
    expect(result).toContain(`The merge base \` ${MERGE_BASE.slice(0, 7)} \` has no stored coverage`);
  });

  it('refuses a diff with a number that is not a count', () => {
    // Arrange
    const bad = JSON.parse(JSON.stringify(diff));
    bad.suites.merged.lines.head = [null, 4];

    // Act
    const parse = () => parseDiff(bad);

    // Assert
    expect(parse).toThrow();
  });
});
