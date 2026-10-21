import { describe, expect, it } from 'vitest';
import { codeSpan, compareSnapshots, MARKER, MAX_ROWS, parseDiff, renderMarkdown, type Snapshot, type SnapshotFunction } from './compare.mts';

const BASE_SHA = 'a'.repeat(40);
const HEAD_SHA = 'b'.repeat(40);

function fn(qualified_name: string, cognitive: number, cyclomatic: number, extra: Partial<SnapshotFunction> = {}): SnapshotFunction {
  return { file: 'src/main/a.ts', qualified_name, line: 1, cognitive, cyclomatic, is_test: false, ...extra };
}

function snapshot(sha: string, functions: SnapshotFunction[]): Snapshot {
  return { sha, date: '2026-10-21T00:00:00Z', functions };
}

describe('compareSnapshots', () => {
  it('lists new and changed functions, and ignores a function that only moved', () => {
    // Arrange
    const base = snapshot(BASE_SHA, [fn('moved', 2, 2), fn('grew', 3, 2), fn('gone', 5, 4)]);
    const head = snapshot(HEAD_SHA, [fn('moved', 2, 2, { line: 40 }), fn('grew', 9, 4), fn('added', 1, 1)]);

    // Act
    const diff = compareSnapshots(base, head);

    // Assert
    expect(diff.rows.map((row) => row.qualified_name)).toEqual(['grew', 'added']);
    expect(diff.rows[1]).toMatchObject({ base_cognitive: null, base_cyclomatic: null });
    expect(diff).toMatchObject({ new_count: 1, changed_count: 1, removed_count: 1 });
    expect(diff.cognitive).toEqual({ base: 10, head: 12 });
    expect(diff.cyclomatic).toEqual({ base: 8, head: 7 });
  });

  it('matches functions by file as well as by name', () => {
    // Arrange
    const base = snapshot(BASE_SHA, [fn('load', 2, 2)]);
    const head = snapshot(HEAD_SHA, [fn('load', 2, 2, { file: 'src/main/b.ts' })]);

    // Act
    const diff = compareSnapshots(base, head);

    // Assert
    expect(diff).toMatchObject({ new_count: 1, removed_count: 1 });
  });

  it('counts only the functions that went above a limit in this change', () => {
    // Arrange
    const base = snapshot(BASE_SHA, [fn('old debt', 20, 3), fn('crossed', 15, 10)]);
    const head = snapshot(HEAD_SHA, [fn('old debt', 22, 3), fn('crossed', 15, 11), fn('new debt', 16, 1)]);

    // Act
    const diff = compareSnapshots(base, head);

    // Assert
    expect(diff.new_above_limits).toBe(2);
    expect(diff.above_limits).toEqual({ base: 1, head: 3 });
  });

  it('leaves test files out', () => {
    // Arrange
    const base = snapshot(BASE_SHA, []);
    const head = snapshot(HEAD_SHA, [fn('it', 30, 30, { file: 'src/main/a.test.ts', is_test: true })]);

    // Act
    const diff = compareSnapshots(base, head);

    // Assert
    expect(diff.rows).toEqual([]);
    expect(diff.cognitive).toEqual({ base: 0, head: 0 });
  });
});

describe('codeSpan', () => {
  it('uses a fence longer than any backtick run in the text', () => {
    // Act
    const result = codeSpan('a``b');

    // Assert
    expect(result).toBe('``` a``b ```');
  });

  it('removes line breaks, bidirectional overrides and table pipes', () => {
    // Act
    const result = codeSpan('a\nb\u202ec|d');

    // Assert
    expect(result).toBe('` a b c∣d `');
  });

  it('shortens long text', () => {
    // Act
    const result = codeSpan('x'.repeat(500));

    // Assert
    expect(result.length).toBeLessThan(130);
    expect(result).toContain('…');
  });
});

describe('renderMarkdown', () => {
  it('starts with the marker and keeps hostile names inside code spans', () => {
    // Arrange
    const name = '@octocat [link](https://example.com) <img src=x>';
    const diff = compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, [fn(name, 20, 3)]));

    // Act
    const markdown = renderMarkdown(diff);

    // Assert
    expect(markdown.startsWith(MARKER)).toBe(true);
    expect(markdown).toContain(`\` ${name} \`<br>`);
    expect(markdown).toContain('| **20** (new) | 3 (new) |');
    expect(markdown.split('\n').filter((line) => line.includes('@octocat'))).toHaveLength(1);
  });

  it(`shows at most ${MAX_ROWS} rows and says how many it left out`, () => {
    // Arrange
    const functions = Array.from({ length: MAX_ROWS + 3 }, (_, index) => fn(`f${index}`, index, 1));
    const diff = compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, functions));

    // Act
    const markdown = renderMarkdown(diff);

    // Assert
    expect(markdown.split('\n').filter((line) => line.startsWith('| `'))).toHaveLength(MAX_ROWS);
    expect(markdown).toContain('3 more changed functions are not shown.');
  });

  it('shows the total change with a sign', () => {
    // Arrange
    const diff = compareSnapshots(snapshot(BASE_SHA, [fn('a', 1200, 4)]), snapshot(HEAD_SHA, [fn('a', 1190, 4)]));

    // Act
    const markdown = renderMarkdown(diff);

    // Assert
    expect(markdown).toContain('Cognitive **−10** (1,200 → 1,190), cyclomatic **±0** (4 → 4)');
  });
});

describe('parseDiff', () => {
  it('accepts a diff from compareSnapshots and drops unknown fields', () => {
    // Arrange
    const diff = compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, [fn('a', 1, 1)]));

    // Act
    const result = parseDiff(JSON.parse(JSON.stringify({ ...diff, extra: '<script>' })));

    // Assert
    expect(result).toEqual(diff);
  });

  it.each([
    ['a bad sha', { base_sha: 'main' }],
    ['a score that is not a number', { new_count: '1' }],
    ['a negative score', { removed_count: -1 }],
    ['rows that are not an array', { rows: 'x' }],
  ])('refuses %s', (_label, change) => {
    // Arrange
    const diff = { ...compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, [])), ...change };

    // Act
    const parse = () => parseDiff(diff);

    // Assert
    expect(parse).toThrow();
  });
});
