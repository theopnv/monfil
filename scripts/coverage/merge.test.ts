import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import libCoverage, { type FileCoverageData } from 'istanbul-lib-coverage';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSuites, fillMissing, loadE2eMap, mergeMaps, rebase, sourcePath, summarize } from './maps.mts';

const ROOT = path.join(path.sep, 'repo');

/** One statement for each entry of `hits`, on its own line, in a file at `file`. */
function fileCoverage(file: string, hits: number[], firstLine = 1): FileCoverageData {
  return {
    path: file,
    statementMap: Object.fromEntries(hits.map((_, index) => [String(index), { start: { line: firstLine + index, column: 0 }, end: { line: firstLine + index, column: 10 } }])),
    s: Object.fromEntries(hits.map((hit, index) => [String(index), hit])),
    fnMap: {},
    f: {},
    branchMap: {},
    b: {},
  };
}

function mapOf(...files: FileCoverageData[]) {
  return libCoverage.createCoverageMap(Object.fromEntries(files.map((data) => [data.path, data])));
}

const abs = (relative: string) => path.join(ROOT, relative);

describe('sourcePath', () => {
  it('gives the path relative to the root with forward slashes', () => {
    // Act
    const result = sourcePath(ROOT, abs('src/main/a.ts'));

    // Assert
    expect(result).toBe('src/main/a.ts');
  });

  it('drops the query of a split module', () => {
    // Act
    const result = sourcePath(ROOT, `${abs('src/renderer/routes/a.tsx')}?tsr-split=component`);

    // Assert
    expect(result).toBe('src/renderer/routes/a.tsx');
  });

  it.each([
    ['a file outside src', abs('scripts/a.ts')],
    ['a file in a sibling folder with the same prefix', abs('src-other/a.ts')],
    ['a dependency', abs('node_modules/x/src/a.ts')],
  ])('gives null for %s', (_label, file) => {
    // Act
    const result = sourcePath(ROOT, file);

    // Assert
    expect(result).toBeNull();
  });
});

describe('rebase', () => {
  it('re-keys by relative path, drops files outside src, and drops the input source map', () => {
    // Arrange
    const map = mapOf(
      { ...fileCoverage(abs('src/a.ts'), [1]), inputSourceMap: { version: 3 } } as FileCoverageData,
      fileCoverage(abs('scripts/b.ts'), [1]),
    );

    // Act
    const result = rebase(map, ROOT);

    // Assert
    expect(result.files()).toEqual(['src/a.ts']);
    expect(result.fileCoverageFor('src/a.ts').data).not.toHaveProperty('inputSourceMap');
  });
});

describe('rebase and Infinity', () => {
  it('gives a statement with an unmapped end column the same key whether it came from JSON or from memory', () => {
    // Arrange
    const unmapped = (column: number | null) => ({
      ...fileCoverage(abs('src/a.ts'), [1]),
      statementMap: { 0: { start: { line: 3, column: 2 }, end: { line: 3, column } } },
    }) as unknown as FileCoverageData;
    const fromJson = rebase(mapOf(unmapped(null)), ROOT);
    const fromMemory = rebase(mapOf(unmapped(Infinity)), ROOT);

    // Act
    const result = mergeMaps(fromJson, fromMemory);

    // Assert
    expect(Object.keys(result.fileCoverageFor('src/a.ts').statementMap)).toHaveLength(1);
    expect(result.fileCoverageFor('src/a.ts').getLineCoverage()).toEqual({ 3: 2 });
  });
});

describe('mergeMaps', () => {
  it('adds the hits of statements at the same location, even when the numbering differs', () => {
    // Arrange
    const vitest = mapOf(fileCoverage('src/a.ts', [1, 0]));
    const e2e = mapOf({ ...fileCoverage('src/a.ts', [0, 3], 1), statementMap: { 7: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } }, 8: { start: { line: 9, column: 0 }, end: { line: 9, column: 10 } } }, s: { 7: 3, 8: 1 } });

    // Act
    const result = mergeMaps(vitest, e2e);

    // Assert
    const lines = result.fileCoverageFor('src/a.ts').getLineCoverage();
    expect(lines).toEqual({ 1: 1, 2: 3, 9: 1 });
  });

  it('leaves the inputs unchanged', () => {
    // Arrange
    const vitest = mapOf(fileCoverage('src/a.ts', [1]));
    const e2e = mapOf(fileCoverage('src/a.ts', [2]));

    // Act
    mergeMaps(vitest, e2e);

    // Assert
    expect(vitest.fileCoverageFor('src/a.ts').s['0']).toBe(1);
  });
});

describe('buildSuites', () => {
  it('counts a file that no launch loaded as uncovered in the e2e suite, and joins both runs in the merged suite', () => {
    // Arrange
    const vitest = mapOf(fileCoverage('src/a.ts', [1, 1]), fileCoverage('src/b.ts', [1, 0]));
    const e2e = mapOf(fileCoverage('src/b.ts', [0, 1]));

    // Act
    const suites = buildSuites(vitest, e2e);

    // Assert
    expect(suites.vitest.map((f) => [f.file, f.lines])).toEqual([['src/a.ts', [2, 2]], ['src/b.ts', [1, 2]]]);
    expect(suites.e2e.map((f) => [f.file, f.lines])).toEqual([['src/a.ts', [0, 2]], ['src/b.ts', [1, 2]]]);
    expect(suites.merged.map((f) => [f.file, f.lines])).toEqual([['src/a.ts', [2, 2]], ['src/b.ts', [2, 2]]]);
  });

  it('does not change the Vitest summary when it merges', () => {
    // Arrange
    const vitest = mapOf(fileCoverage('src/a.ts', [0]));
    const e2e = mapOf(fileCoverage('src/a.ts', [4]));

    // Act
    const suites = buildSuites(vitest, e2e);

    // Assert
    expect(suites.vitest[0]?.lines).toEqual([0, 1]);
    expect(summarize(vitest)[0]?.lines).toEqual([0, 1]);
  });
});

describe('fillMissing', () => {
  it('copies a missing file with every hit at 0 and keeps the present ones', () => {
    // Arrange
    const map = mapOf(fileCoverage('src/a.ts', [3]));
    const universe = mapOf(fileCoverage('src/a.ts', [1]), fileCoverage('src/b.ts', [5]));

    // Act
    const result = fillMissing(map, universe);

    // Assert
    expect(result.fileCoverageFor('src/a.ts').s['0']).toBe(3);
    expect(result.fileCoverageFor('src/b.ts').s['0']).toBe(0);
    expect(universe.fileCoverageFor('src/b.ts').s['0']).toBe(5);
  });
});

describe('loadE2eMap', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true });
    }
  });

  it('merges the maps of every dump and counts the files it read', async () => {
    // Arrange
    dir = await mkdtemp(path.join(os.tmpdir(), 'coverage-e2e-'));
    await writeFile(path.join(dir, '1-a.json'), JSON.stringify([{ [abs('src/a.ts')]: fileCoverage(abs('src/a.ts'), [1]) }]));
    await writeFile(path.join(dir, '2-b.json'), JSON.stringify([{ [abs('src/a.ts')]: fileCoverage(abs('src/a.ts'), [2]) }, { [abs('src/b.ts')]: fileCoverage(abs('src/b.ts'), [1]) }]));
    await writeFile(path.join(dir, 'notes.txt'), 'not coverage');

    // Act
    const { map, fileCount } = await loadE2eMap(dir, ROOT);

    // Assert
    expect(fileCount).toBe(2);
    expect(map.fileCoverageFor('src/a.ts').s['0']).toBe(3);
    expect(map.files().sort()).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
