import { expectDate, expectInteger, expectObject, expectSha, expectText, ValidationError } from '../shared/expect.ts';
import { folderPrefixes } from '../shared/folders.ts';

export const LIMITS = { cognitive: 15, cyclomatic: 10 } as const;
export const MAX_FUNCTIONS = 50_000;

export interface FunctionRow {
  file: string;
  qualified_name: string;
  line: number;
  cyclomatic: number;
  cognitive: number;
  is_test: boolean;
}

export interface Snapshot {
  sha: string;
  /** UTC ISO 8601, so that dates sort as text. */
  date: string;
  functions: FunctionRow[];
}

export interface FolderSummary {
  folder: string;
  is_test: boolean;
  function_count: number;
  cognitive_sum: number;
  cyclomatic_sum: number;
  cognitive_max: number;
  cyclomatic_max: number;
  cognitive_above: number;
  cyclomatic_above: number;
  above_limits: number;
}

export class SnapshotError extends ValidationError {
  override name = 'SnapshotError';
}

function parseFunction(value: unknown, index: number): FunctionRow {
  const field = `functions[${index}]`;
  const fn = expectObject(value, field);
  if (typeof fn['is_test'] !== 'boolean') {
    throw new SnapshotError(`${field}.is_test must be a boolean`);
  }
  return {
    file: expectText(fn['file'], `${field}.file`),
    qualified_name: expectText(fn['qualified_name'], `${field}.qualified_name`),
    line: expectInteger(fn['line'], `${field}.line`),
    cyclomatic: expectInteger(fn['cyclomatic'], `${field}.cyclomatic`),
    cognitive: expectInteger(fn['cognitive'], `${field}.cognitive`),
    is_test: fn['is_test'],
  };
}

/** Checks a snapshot written by `scripts/complexity/index.mts`. */
export function parseSnapshot(value: unknown): Snapshot {
  const snapshot = expectObject(value, 'snapshot');
  const functions = snapshot['functions'];
  if (!Array.isArray(functions) || functions.length > MAX_FUNCTIONS) {
    throw new SnapshotError(`functions must be an array of at most ${MAX_FUNCTIONS} items`);
  }
  return { sha: expectSha(snapshot['sha']), date: expectDate(snapshot['date']), functions: functions.map(parseFunction) };
}

function emptySummary(folder: string, isTest: boolean): FolderSummary {
  return {
    folder,
    is_test: isTest,
    function_count: 0,
    cognitive_sum: 0,
    cyclomatic_sum: 0,
    cognitive_max: 0,
    cyclomatic_max: 0,
    cognitive_above: 0,
    cyclomatic_above: 0,
    above_limits: 0,
  };
}

function addFunction(summary: FolderSummary, fn: FunctionRow): void {
  const cognitiveAbove = fn.cognitive > LIMITS.cognitive;
  const cyclomaticAbove = fn.cyclomatic > LIMITS.cyclomatic;
  summary.function_count += 1;
  summary.cognitive_sum += fn.cognitive;
  summary.cyclomatic_sum += fn.cyclomatic;
  summary.cognitive_max = Math.max(summary.cognitive_max, fn.cognitive);
  summary.cyclomatic_max = Math.max(summary.cyclomatic_max, fn.cyclomatic);
  summary.cognitive_above += Number(cognitiveAbove);
  summary.cyclomatic_above += Number(cyclomaticAbove);
  summary.above_limits += Number(cognitiveAbove || cyclomaticAbove);
}

/** Builds one summary for each folder and test flag, counting each function in every folder above it. */
export function summarize(functions: FunctionRow[]): FolderSummary[] {
  const summaries = new Map<string, FolderSummary>();
  for (const fn of functions) {
    for (const folder of folderPrefixes(fn.file)) {
      const key = `${folder}\u0000${fn.is_test}`;
      let summary = summaries.get(key);
      if (!summary) {
        summary = emptySummary(folder, fn.is_test);
        summaries.set(key, summary);
      }
      addFunction(summary, fn);
    }
  }
  return [...summaries.values()];
}
