import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { countPlaywright, countVitest, type VitestResults } from './tests.mts';

const ROOT = path.join(path.sep, 'repo');

function vitestFile(relative: string, ...statuses: string[]): VitestResults['testResults'][number] {
  return { name: path.join(ROOT, relative), assertionResults: statuses.map((status) => ({ status })) };
}

describe('countVitest', () => {
  it('splits the files into the unit and integration projects by path, across runs', () => {
    // Arrange
    const node = { testResults: [vitestFile('src/main/a.test.ts', 'passed', 'passed', 'failed'), vitestFile('scripts/b.test.ts', 'passed')] };
    const browser = { testResults: [vitestFile('src/renderer/c.test.tsx', 'passed', 'skipped', 'todo', 'pending')] };

    // Act
    const result = countVitest([node, browser], ROOT);

    // Assert
    expect(result).toEqual({
      unit: { files: 2, tests: 4, passed: 3, failed: 1, skipped: 0 },
      integration: { files: 1, tests: 4, passed: 1, failed: 0, skipped: 3 },
    });
  });

  it('counts a file outside src/renderer with a similar name as a unit test', () => {
    // Act
    const result = countVitest([{ testResults: [vitestFile('src/renderer-old/a.test.ts', 'passed')] }], ROOT);

    // Assert
    expect(result.unit.tests).toBe(1);
    expect(result.integration.tests).toBe(0);
  });
});

describe('countPlaywright', () => {
  it('counts a flaky test as passed and one suite for each spec file', () => {
    // Act
    const result = countPlaywright({ suites: [{}, {}, {}], stats: { expected: 10, unexpected: 1, flaky: 2, skipped: 3 } });

    // Assert
    expect(result).toEqual({ files: 3, tests: 16, passed: 12, failed: 1, skipped: 3 });
  });
});
