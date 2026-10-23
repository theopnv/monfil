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
  it('groups new violations, worse violations and improvements, and ignores everything else', () => {
    // Arrange
    const base = snapshot(BASE_SHA, [
      fn('moved', 2, 2), fn('small growth', 3, 2), fn('old debt', 20, 3), fn('same debt', 20, 3),
      fn('crossed', 15, 10), fn('fixed', 20, 3), fn('gone', 30, 3),
    ]);
    const head = snapshot(HEAD_SHA, [
      fn('moved', 2, 2, { line: 40 }), fn('small growth', 9, 4), fn('old debt', 22, 3), fn('same debt', 20, 3),
      fn('crossed', 15, 11), fn('fixed', 5, 3), fn('new debt', 16, 1), fn('new small', 1, 1),
    ]);

    // Act
    const diff = compareSnapshots(base, head);

    // Assert
    expect(diff.introduced.map((row) => row.qualified_name)).toEqual(['new debt']);
    expect(diff.introduced[0]).toMatchObject({ base_cognitive: null, base_cyclomatic: null });
    expect(diff.worse.map((row) => row.qualified_name)).toEqual(['old debt', 'crossed']);
    expect(diff.improved.map((row) => row.qualified_name)).toEqual(['fixed']);
    expect(diff.above_limits).toEqual({ base: 4, head: 4 });
  });

  it('matches functions by file as well as by name', () => {
    // Arrange
    const base = snapshot(BASE_SHA, [fn('load', 20, 2)]);
    const head = snapshot(HEAD_SHA, [fn('load', 20, 2, { file: 'src/main/b.ts' })]);

    // Act
    const diff = compareSnapshots(base, head);

    // Assert
    expect(diff.introduced).toHaveLength(1);
    expect(diff.worse).toEqual([]);
  });

  it('leaves test files out', () => {
    // Arrange
    const base = snapshot(BASE_SHA, []);
    const head = snapshot(HEAD_SHA, [fn('it', 30, 30, { file: 'src/main/a.test.ts', is_test: true })]);

    // Act
    const diff = compareSnapshots(base, head);

    // Assert
    expect(diff.introduced).toEqual([]);
    expect(diff.above_limits).toEqual({ base: 0, head: 0 });
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
    expect(markdown).toContain('**New functions above the limits (1)**');
    expect(markdown).toContain(`\` ${name} \`<br>`);
    expect(markdown).toContain('| **20** (new) | 3 (new) |');
    expect(markdown.split('\n').filter((line) => line.includes('@octocat'))).toHaveLength(1);
  });

  it('says in one line that nothing crossed the limits, and counts the old violations', () => {
    // Arrange
    const diff = compareSnapshots(snapshot(BASE_SHA, [fn('old', 20, 3), fn('ok', 1, 1)]), snapshot(HEAD_SHA, [fn('old', 20, 3), fn('ok', 2, 1)]));

    // Act
    const markdown = renderMarkdown(diff);

    // Assert
    expect(markdown).toContain('No function crossed the limits. 1 old violation remains.');
    expect(markdown).not.toContain('| Function |');
  });

  it('says so when no function is above the limits', () => {
    // Arrange
    const diff = compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, [fn('ok', 1, 1)]));

    // Act
    const markdown = renderMarkdown(diff);

    // Assert
    expect(markdown).toContain('No function crossed the limits. No function is above the limits.');
  });

  it('shows the three groups, and tells how to prune the suppressions after an improvement', () => {
    // Arrange
    const base = snapshot(BASE_SHA, [fn('worse', 20, 3), fn('better', 20, 3)]);
    const head = snapshot(HEAD_SHA, [fn('worse', 21, 3), fn('better', 4, 3), fn('fresh', 16, 1)]);

    // Act
    const markdown = renderMarkdown(compareSnapshots(base, head));

    // Assert
    expect(markdown).toContain('**New functions above the limits (1)**');
    expect(markdown).toContain('**Existing functions above the limits that got worse (1)**');
    expect(markdown).toContain('| **21** (+1) | 3 (±0) |');
    expect(markdown).toContain('**Functions that dropped below the limits (1)**');
    expect(markdown).toContain('| 4 (−16) | 3 (±0) |');
    expect(markdown).toContain('npx eslint --prune-suppressions .');
    expect(markdown).toContain('2 functions are above the limits in total.');
  });

  it(`shows at most ${MAX_ROWS} rows of a group and says how many it left out`, () => {
    // Arrange
    const functions = Array.from({ length: MAX_ROWS + 3 }, (_, index) => fn(`f${index}`, 16 + index, 1));
    const diff = compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, functions));

    // Act
    const markdown = renderMarkdown(diff);

    // Assert
    expect(markdown.split('\n').filter((line) => line.startsWith('| `'))).toHaveLength(MAX_ROWS);
    expect(markdown).toContain('3 more functions are not shown.');
  });
});

describe('parseDiff', () => {
  it('accepts a diff from compareSnapshots and drops unknown fields', () => {
    // Arrange
    const diff = compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, [fn('a', 20, 1)]));

    // Act
    const result = parseDiff(JSON.parse(JSON.stringify({ ...diff, extra: '<script>' })));

    // Assert
    expect(result).toEqual(diff);
  });

  it.each([
    ['a bad sha', { base_sha: 'main' }],
    ['a count that is not a number', { above_limits: { base: '1', head: 1 } }],
    ['a negative count', { above_limits: { base: -1, head: 1 } }],
    ['rows that are not an array', { introduced: 'x' }],
  ])('refuses %s', (_label, change) => {
    // Arrange
    const diff = { ...compareSnapshots(snapshot(BASE_SHA, []), snapshot(HEAD_SHA, [])), ...change };

    // Act
    const parse = () => parseDiff(diff);

    // Assert
    expect(parse).toThrow();
  });
});
