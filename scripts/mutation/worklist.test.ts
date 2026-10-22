import type { MutantResult, MutationTestResult } from 'mutation-testing-report-schema';
import { describe, expect, it } from 'vitest';
import { code, narrowReport, renderWorklist } from './worklist.mts';

const SOURCE = 'export const ok = (a: number) => a > 0;\n';
const AT = { start: { line: 1, column: 34 }, end: { line: 1, column: 39 } };

function mutant(id: string, status: MutantResult['status'], extra: Partial<MutantResult> = {}): MutantResult {
  return { id, mutatorName: 'EqualityOperator', replacement: 'a >= 0', status, location: AT, ...extra };
}

function report(files: Record<string, MutantResult[]>): MutationTestResult {
  return {
    schemaVersion: '2',
    thresholds: { high: 80, low: 60 },
    files: Object.fromEntries(Object.entries(files).map(([file, mutants]) => [file, { language: 'typescript', source: SOURCE, mutants }])),
    testFiles: { 'src/main/ok.test.ts': { tests: [{ id: 't1', name: 'ok > accepts 1' }, { id: 't2', name: 'ok > rejects -1' }] } },
  };
}

describe('code', () => {
  it.each([
    ['a plain text', 'a > 0', '`a > 0`'],
    ['a text with a backtick', 'a`b', '`` a`b ``'],
    ['an empty text', '', '(empty)'],
  ])('writes %s', (_label, text, expected) => {
    // Act
    const result = code(text);

    // Assert
    expect(result).toBe(expected);
  });
});

describe('narrowReport', () => {
  it('keeps the files under a path and leaves a file with a longer name out', () => {
    // Arrange
    const full = report({ 'src/main/feed/a.ts': [], 'src/main/feed-old/b.ts': [], 'src/main/c.ts': [] });

    // Act
    const result = narrowReport(full, ['src/main/feed/']);

    // Assert
    expect(Object.keys(result.files)).toEqual(['src/main/feed/a.ts']);
  });
});

describe('renderWorklist', () => {
  it('lists each undetected mutant with its text, and the tests that add no detection', () => {
    // Arrange
    const result = report({
      'src/main/ok.ts': [
        mutant('1', 'Killed', { coveredBy: ['t1', 't2'], killedBy: ['t1'] }),
        mutant('2', 'Survived', { coveredBy: ['t1', 't2'] }),
      ],
      'src/main/clean.ts': [mutant('3', 'Killed', { coveredBy: ['t1'], killedBy: ['t1'] })],
    });

    // Act
    const markdown = renderWorklist('unit', result);

    // Assert
    expect(markdown).toContain('Score 66.7%: 2 detected, 1 survived, 0 not covered, in 2 files.');
    expect(markdown).toContain('### `src/main/ok.ts`: 50.0%, 1 survived, 0 not covered');
    expect(markdown).toContain('- L1:34 EqualityOperator, survived: `a > 0` → `a >= 0`');
    expect(markdown).not.toContain('### `src/main/clean.ts`');
    const entry = markdown.indexOf('- `src/main/ok.test.ts`\n  - ok > rejects -1 (covers 2)');
    expect(entry).toBeGreaterThan(markdown.indexOf('### Tests that kill no mutant'));
    expect(entry).toBeLessThan(markdown.indexOf('### Tests without a unique kill'));
  });
});
