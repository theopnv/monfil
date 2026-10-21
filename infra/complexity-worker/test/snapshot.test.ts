import { describe, expect, it } from 'vitest';
import { folderPrefixes, parseSnapshot, SnapshotError, summarize, type FunctionRow } from '../src/snapshot.ts';

const SHA = 'a'.repeat(40);

function fn(file: string, cognitive: number, cyclomatic: number, is_test = false): FunctionRow {
  return { file, qualified_name: `f${cognitive}`, line: 1, cognitive, cyclomatic, is_test };
}

describe('folderPrefixes', () => {
  it('lists every folder above a file, from the top', () => {
    // Act
    const result = folderPrefixes('src/main/feed/refresh.ts');

    // Assert
    expect(result).toEqual(['src', 'src/main', 'src/main/feed']);
  });
});

describe('summarize', () => {
  it('counts a function in each folder above it, and keeps test files apart', () => {
    // Arrange
    const functions = [fn('src/main/a.ts', 20, 3), fn('src/main/feed/b.ts', 2, 12), fn('src/main/a.test.ts', 30, 30, true)];

    // Act
    const result = summarize(functions);

    // Assert
    const src = result.find((s) => s.folder === 'src' && !s.is_test);
    expect(src).toMatchObject({
      function_count: 2, cognitive_sum: 22, cyclomatic_sum: 15, cognitive_max: 20, cyclomatic_max: 12,
      cognitive_above: 1, cyclomatic_above: 1, above_limits: 2,
    });
    expect(result.find((s) => s.folder === 'src/main/feed')).toMatchObject({ function_count: 1, above_limits: 1 });
    expect(result.find((s) => s.folder === 'src' && s.is_test)).toMatchObject({ function_count: 1, cognitive_sum: 30 });
    expect(result).toHaveLength(5);
  });
});

describe('parseSnapshot', () => {
  it('converts the date to UTC so that dates sort as text', () => {
    // Act
    const result = parseSnapshot({ sha: SHA, date: '2026-10-20T17:56:56+02:00', functions: [] });

    // Assert
    expect(result.date).toBe('2026-10-20T15:56:56.000Z');
  });

  it.each([
    ['a bad sha', { sha: 'main', date: '2026-10-20', functions: [] }],
    ['a bad date', { sha: SHA, date: 'yesterday', functions: [] }],
    ['functions that are not an array', { sha: SHA, date: '2026-10-20', functions: {} }],
    ['a score that is not an integer', { sha: SHA, date: '2026-10-20', functions: [{ ...fn('src/a.ts', 1, 1), cognitive: 1.5 }] }],
    ['a missing is_test flag', { sha: SHA, date: '2026-10-20', functions: [{ file: 'src/a.ts', qualified_name: 'a', line: 1, cognitive: 0, cyclomatic: 1 }] }],
  ])('refuses %s', (_label, body) => {
    // Act
    const parse = () => parseSnapshot(body);

    // Assert
    expect(parse).toThrow(SnapshotError);
  });
});
