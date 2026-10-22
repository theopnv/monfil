import type { MutantResult, MutantStatus, MutationTestResult } from 'mutation-testing-report-schema';
import { describe, expect, it } from 'vitest';
import { falseSurvivors, fileResults, MAX_TEXT, originalText, testValues } from './report.mts';

const SOURCE = ['export function max(a: number, b: number) {', '  return a > b ? a : b;', '}', ''].join('\n');

function mutant(id: string, status: MutantStatus, extra: Partial<MutantResult> = {}): MutantResult {
  return {
    id,
    mutatorName: 'EqualityOperator',
    replacement: 'a >= b',
    status,
    location: { start: { line: 2, column: 10 }, end: { line: 2, column: 15 } },
    ...extra,
  };
}

function report(mutants: MutantResult[], file = 'src/main/max.ts'): MutationTestResult {
  return { schemaVersion: '2', thresholds: { high: 80, low: 60 }, files: { [file]: { language: 'typescript', source: SOURCE, mutants } } };
}

describe('falseSurvivors', () => {
  it('lists a survivor that ran none of the tests that cover it', () => {
    // Arrange
    const broken = mutant('1', 'Survived', { coveredBy: ['t1', 't2'], testsCompleted: 0 });

    // Act
    const result = falseSurvivors(report([broken]));

    // Assert
    expect(result).toEqual([{ file: 'src/main/max.ts', mutant: broken }]);
  });

  it.each([
    ['a survivor that ran its tests', mutant('1', 'Survived', { coveredBy: ['t1'], testsCompleted: 1 })],
    ['a survivor that no test covers', mutant('1', 'Survived', { coveredBy: [], testsCompleted: 0 })],
    ['a static survivor without per-test coverage', mutant('1', 'Survived', { static: true, testsCompleted: 900 })],
    ['a mutant without tests that the type check refused', mutant('1', 'CompileError', { coveredBy: ['t1'], testsCompleted: 0 })],
  ])('accepts %s', (_label, result) => {
    // Act
    const found = falseSurvivors(report([result]));

    // Assert
    expect(found).toEqual([]);
  });
});

describe('originalText', () => {
  it('reads the replaced text with one-based lines and columns', () => {
    // Act
    const result = originalText(SOURCE, { start: { line: 2, column: 10 }, end: { line: 2, column: 15 } });

    // Assert
    expect(result).toBe('a > b');
  });

  it('reads a text across lines', () => {
    // Act
    const result = originalText(SOURCE, { start: { line: 1, column: 43 }, end: { line: 3, column: 2 } });

    // Assert
    expect(result).toBe('{\n  return a > b ? a : b;\n}');
  });
});

describe('fileResults', () => {
  it('counts the statuses, scores the file and lists its undetected mutants in source order', () => {
    // Arrange
    const result = report([
      mutant('1', 'Killed'), mutant('2', 'Timeout'), mutant('3', 'Survived', { replacement: 'a >= b' }),
      mutant('4', 'NoCoverage', { replacement: 'false', location: { start: { line: 1, column: 1 }, end: { line: 1, column: 7 } } }),
      mutant('5', 'CompileError'), mutant('6', 'Ignored'),
    ]);

    // Act
    const [file] = fileResults(result);

    // Assert
    expect(file).toEqual({
      file: 'src/main/max.ts',
      killed: 2,
      survived: 1,
      noCoverage: 1,
      score: 50,
      weaknesses: [
        { line: 1, column: 1, status: 'NoCoverage', mutator: 'EqualityOperator', original: 'export', replacement: 'false' },
        { line: 2, column: 10, status: 'Survived', mutator: 'EqualityOperator', original: 'a > b', replacement: 'a >= b' },
      ],
    });
  });

  it('puts the file with the most undetected mutants first and cuts long text to one short line', () => {
    // Arrange
    const result: MutationTestResult = {
      ...report([mutant('1', 'Survived', { replacement: 'x\n'.repeat(200) })], 'src/main/a.ts'),
    };
    result.files['src/main/b.ts'] = { language: 'typescript', source: SOURCE, mutants: [mutant('2', 'Survived'), mutant('3', 'Survived')] };

    // Act
    const files = fileResults(result);

    // Assert
    expect(files.map((file) => file.file)).toEqual(['src/main/b.ts', 'src/main/a.ts']);
    expect(files[1]?.weaknesses[0]?.replacement).toHaveLength(MAX_TEXT);
    expect(files[1]?.weaknesses[0]?.replacement).not.toContain('\n');
  });
});

describe('testValues', () => {
  it('counts covered mutants, kills and unique kills for each test, and skips mutants that never ran', () => {
    // Arrange
    const result: MutationTestResult = {
      ...report([
        mutant('1', 'Killed', { coveredBy: ['t1', 't2'], killedBy: ['t1', 't2'] }),
        mutant('2', 'Killed', { coveredBy: ['t1', 't2'], killedBy: ['t1'] }),
        mutant('3', 'Survived', { coveredBy: ['t2', 't3'] }),
        mutant('4', 'CompileError', { coveredBy: ['t3'] }),
      ]),
      projectRoot: '/repo',
      testFiles: {
        '/repo/src/main/max.test.ts': { tests: [{ id: 't1', name: 'max > picks a' }, { id: 't2', name: 'max > picks b' }] },
        'src/main/other.test.ts': { tests: [{ id: 't3', name: 'other' }] },
      },
    };

    // Act
    const tests = testValues(result);

    // Assert
    expect(tests).toEqual([
      { file: 'src/main/max.test.ts', name: 'max > picks a', covered: 2, killed: 2, uniqueKills: 1 },
      { file: 'src/main/max.test.ts', name: 'max > picks b', covered: 3, killed: 1, uniqueKills: 0 },
      { file: 'src/main/other.test.ts', name: 'other', covered: 1, killed: 0, uniqueKills: 0 },
    ]);
  });
});
