import { describe, expect, it } from 'vitest';
import { CoverageSnapshotError, parseCoverageSnapshot, summarizeCoverage, type CoverageSnapshot, type FileCoverage } from '../src/coverage/snapshot.ts';
import { ValidationError } from '../src/shared/expect.ts';

const SHA = 'a'.repeat(40);

function file(name: string, covered: number, total: number): FileCoverage {
  return { file: name, lines: [covered, total], statements: [covered, total], functions: [covered, total], branches: [0, 0] };
}

function snapshot(files: FileCoverage[]): CoverageSnapshot {
  return { sha: SHA, date: '2026-10-21T00:00:00.000Z', suites: { vitest: files, e2e: [], merged: files } };
}

describe('summarizeCoverage', () => {
  it('adds each file to every folder above it, for each suite', () => {
    // Arrange
    const files = [file('src/main/a.ts', 1, 2), file('src/main/feed/b.ts', 3, 4), file('src/renderer/c.ts', 5, 6)];

    // Act
    const result = summarizeCoverage(snapshot(files));

    // Assert
    const main = result.find((s) => s.suite === 'merged' && s.folder === 'src/main');
    expect(main).toMatchObject({ file_count: 2, sums: [4, 6, 4, 6, 4, 6, 0, 0] });
    expect(result.find((s) => s.suite === 'vitest' && s.folder === 'src')).toMatchObject({ file_count: 3 });
    expect(result.some((s) => s.suite === 'e2e')).toBe(false);
    expect(result).toHaveLength(8);
  });
});

describe('parseCoverageSnapshot', () => {
  it('converts the date to UTC so that dates sort as text', () => {
    // Act
    const result = parseCoverageSnapshot({ ...snapshot([]), date: '2026-10-20T17:56:56+02:00' });

    // Assert
    expect(result.date).toBe('2026-10-20T15:56:56.000Z');
  });

  it.each([
    ['a bad sha', { ...snapshot([]), sha: 'main' }],
    ['a bad date', { ...snapshot([]), date: 'yesterday' }],
    ['a missing suite', { sha: SHA, date: '2026-10-21', suites: { vitest: [], e2e: [] } }],
    ['a count that is not an integer', snapshot([{ ...file('src/a.ts', 1, 2), lines: [0.5, 2] }])],
    ['a pair of the wrong length', snapshot([{ ...file('src/a.ts', 1, 2), lines: [1] } as unknown as FileCoverage])],
    ['a negative count', snapshot([file('src/a.ts', -1, 2)])],
  ])('refuses %s', (_label, body) => {
    // Act
    const parse = () => parseCoverageSnapshot(body);

    // Assert
    expect(parse).toThrow(ValidationError);
  });

  it('refuses a suite with too many files with the coverage error', () => {
    // Act
    const parse = () => parseCoverageSnapshot(snapshot(Array.from({ length: 5001 }, (_, i) => file(`src/f${i}.ts`, 0, 1))));

    // Assert
    expect(parse).toThrow(CoverageSnapshotError);
  });
});
