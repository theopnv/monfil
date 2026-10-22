import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import libCoverage, { type CoverageMap, type CoverageMapData, type FileCoverageData } from 'istanbul-lib-coverage';
import libSourceMaps from 'istanbul-lib-source-maps';
import type { TestSuites } from './tests.mts';

export type Count = [covered: number, total: number];

export interface FileSummary {
  file: string;
  lines: Count;
  statements: Count;
  functions: Count;
  branches: Count;
}

export interface Snapshot {
  sha: string;
  date: string;
  suites: { vitest: FileSummary[]; e2e: FileSummary[]; merged: FileSummary[] };
  tests?: TestSuites;
}

const SOURCE_ROOT = 'src/';

/**
 * Gives the path of a source file relative to the repository root, or null for a file outside `src/`.
 * The router plugin's split modules name their source with a query, which belongs to no file.
 */
export function sourcePath(root: string, file: string): string | null {
  const [withoutQuery = file] = file.split('?');
  const relative = path.relative(root, withoutQuery).split(path.sep).join('/');
  return relative.startsWith(SOURCE_ROOT) ? relative : null;
}

interface Location {
  start: { line: number; column: number | null };
  end: { line: number; column: number | null };
}

/**
 * The source map step gives an unmapped end column as Infinity, and JSON writes that as null. Istanbul keys a location
 * by its text, so a map from a JSON file would not match the same statement in memory.
 */
function restoreInfinity(location: Location | undefined): void {
  for (const point of location ? [location.start, location.end] : []) {
    point.column ??= Infinity;
  }
}

function restoreLocations(data: FileCoverageData): void {
  Object.values(data.statementMap).forEach(restoreInfinity);
  Object.values(data.fnMap).forEach((fn) => {
    restoreInfinity(fn.decl);
    restoreInfinity(fn.loc);
  });
  Object.values(data.branchMap).forEach((branch) => {
    restoreInfinity(branch.loc);
    branch.locations.forEach(restoreInfinity);
  });
}

/** Re-keys a map by repository-relative paths and drops everything outside `src/`, so that maps from different checkouts compare. */
export function rebase(map: CoverageMap, root: string): CoverageMap {
  const result = libCoverage.createCoverageMap({});
  for (const file of map.files()) {
    const relative = sourcePath(root, file);
    if (relative) {
      const data = { ...map.fileCoverageFor(file).toJSON() as FileCoverageData & { inputSourceMap?: unknown }, path: relative };
      delete data.inputSourceMap;
      restoreLocations(data);
      result.addFileCoverage(data);
    }
  }
  return result;
}

function cloneMap(map: CoverageMap): CoverageMap {
  const result = libCoverage.createCoverageMap({});
  for (const file of map.files()) {
    result.addFileCoverage(structuredClone(map.fileCoverageFor(file).toJSON()) as FileCoverageData);
  }
  return result;
}

/** Adds each file of `universe` that `map` lacks with all hits at 0, so that unloaded files count as uncovered. */
export function fillMissing(map: CoverageMap, universe: CoverageMap): CoverageMap {
  const result = cloneMap(map);
  for (const file of universe.files()) {
    if (!result.data[file]) {
      const copy = libCoverage.createFileCoverage(structuredClone(universe.fileCoverageFor(file).toJSON()) as FileCoverageData);
      copy.resetHits();
      result.addFileCoverage(copy);
    }
  }
  return result;
}

/** Merges maps by statement, function and branch location, so entries of different numbering add up. */
export function mergeMaps(...maps: CoverageMap[]): CoverageMap {
  const result = libCoverage.createCoverageMap({});
  for (const map of maps) {
    // The result keeps the file coverage objects it receives and adds hits to them, so it gets copies.
    result.merge(cloneMap(map));
  }
  return result;
}

export async function loadVitestMap(file: string, root: string): Promise<CoverageMap> {
  const data = JSON.parse(await readFile(file, 'utf8')) as CoverageMapData;
  return rebase(libCoverage.createCoverageMap(data), root);
}

/** Maps the instrumented coordinates of one process back to the files. Entries with a query have the file as source. */
async function remap(data: CoverageMapData, root: string): Promise<CoverageMap> {
  const store = libSourceMaps.createSourceMapStore({ baseDir: root });
  const mapped = await store.transformCoverage(libCoverage.createCoverageMap(data));
  store.dispose();
  return rebase(mapped, root);
}

export interface E2eResult {
  map: CoverageMap;
  fileCount: number;
}

/** Reads the dumps of `coverage/e2e/raw`. Each dump is a list of coverage maps, one for each process and window of one launch. */
export async function loadE2eMap(dir: string, root: string): Promise<E2eResult> {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  const maps: CoverageMap[] = [];
  for (const name of names) {
    const dumps = JSON.parse(await readFile(path.join(dir, name), 'utf8')) as CoverageMapData[];
    for (const dump of dumps) {
      maps.push(await remap(dump, root));
    }
  }
  return { map: mergeMaps(...maps), fileCount: names.length };
}

function count(summary: { covered: number; total: number }): Count {
  return [summary.covered, summary.total];
}

export function summarize(map: CoverageMap): FileSummary[] {
  return map.files().sort().map((file) => {
    const summary = map.fileCoverageFor(file).toSummary();
    return {
      file,
      lines: count(summary.lines),
      statements: count(summary.statements),
      functions: count(summary.functions),
      branches: count(summary.branches),
    };
  });
}

/** Builds the three suites. The e2e suite lists every file of the Vitest run, so a file that no launch loaded counts as uncovered. */
export function buildSuites(vitest: CoverageMap, e2e: CoverageMap): Snapshot['suites'] & { mergedMap: CoverageMap } {
  const e2eFull = fillMissing(e2e, vitest);
  const mergedMap = mergeMaps(vitest, e2e);
  return { vitest: summarize(vitest), e2e: summarize(e2eFull), merged: summarize(mergedMap), mergedMap };
}

/** Adds up one metric over the files. */
export function total(files: FileSummary[], metric: 'lines' | 'statements' | 'functions' | 'branches'): Count {
  return files.reduce<Count>((sum, file) => [sum[0] + file[metric][0], sum[1] + file[metric][1]], [0, 0]);
}
