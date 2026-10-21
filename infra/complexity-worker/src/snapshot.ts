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

export class SnapshotError extends Error {
  override name = 'SnapshotError';
}

function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SnapshotError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1000) {
    throw new SnapshotError(`${field} must be a string of 1 to 1000 characters`);
  }
  return value;
}

// Range checks belong to the table constraints, so a bad value fails the whole batch.
function expectInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new SnapshotError(`${field} must be a non-negative integer`);
  }
  return value as number;
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

function parseDate(value: unknown): string {
  const text = expectText(value, 'date');
  const time = Date.parse(text);
  if (Number.isNaN(time)) {
    throw new SnapshotError('date must be an ISO 8601 date');
  }
  return new Date(time).toISOString();
}

/** Checks a snapshot written by `scripts/complexity/index.mts`. */
export function parseSnapshot(value: unknown): Snapshot {
  const snapshot = expectObject(value, 'snapshot');
  const sha = snapshot['sha'];
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new SnapshotError('sha must be a 40-character commit sha');
  }
  const functions = snapshot['functions'];
  if (!Array.isArray(functions) || functions.length > MAX_FUNCTIONS) {
    throw new SnapshotError(`functions must be an array of at most ${MAX_FUNCTIONS} items`);
  }
  return { sha, date: parseDate(snapshot['date']), functions: functions.map(parseFunction) };
}

/** Lists the folders that contain a file, from the top: `src/main/a.ts` gives `src` and `src/main`. */
export function folderPrefixes(file: string): string[] {
  const parts = file.split('/').slice(0, -1);
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
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
