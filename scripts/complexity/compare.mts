import { expectCount, expectObject, expectSha, expectString } from '../devanalytics/expect.mts';
import { codeSpan, MAX_ROWS } from '../devanalytics/markdown.mts';
import { LIMITS } from './limits.mts';

export const MARKER = '<!-- complexity-report -->';

export interface SnapshotFunction {
  file: string;
  qualified_name: string;
  line: number;
  cyclomatic: number;
  cognitive: number;
  is_test: boolean;
}

export interface Snapshot {
  sha: string;
  date: string;
  functions: SnapshotFunction[];
}

export interface Totals {
  base: number;
  head: number;
}

export interface DiffRow {
  file: string;
  qualified_name: string;
  line: number;
  cognitive: number;
  cyclomatic: number;
  /** Null when the function is new. */
  base_cognitive: number | null;
  base_cyclomatic: number | null;
}

export interface Diff {
  base_sha: string;
  head_sha: string;
  above_limits: Totals;
  /** New functions above a limit. The most complex first. */
  introduced: DiffRow[];
  /** Existing functions above a limit that got more complex. The most complex first. */
  worse: DiffRow[];
  /** Existing functions that were above a limit and now are below both. The most complex first. */
  improved: DiffRow[];
}

const key = (fn: SnapshotFunction) => `${fn.file}\u0000${fn.qualified_name}`;

export function isAboveLimits(fn: { cognitive: number; cyclomatic: number }): boolean {
  return fn.cognitive > LIMITS.cognitive || fn.cyclomatic > LIMITS.cyclomatic;
}

function toRow(fn: SnapshotFunction, base: SnapshotFunction | undefined): DiffRow {
  return {
    file: fn.file,
    qualified_name: fn.qualified_name,
    line: fn.line,
    cognitive: fn.cognitive,
    cyclomatic: fn.cyclomatic,
    base_cognitive: base?.cognitive ?? null,
    base_cyclomatic: base?.cyclomatic ?? null,
  };
}

function byComplexity(a: DiffRow, b: DiffRow): number {
  return b.cognitive - a.cognitive || b.cyclomatic - a.cyclomatic
    || a.file.localeCompare(b.file) || a.line - b.line;
}

function grew(fn: SnapshotFunction, before: SnapshotFunction): boolean {
  return fn.cognitive > before.cognitive || fn.cyclomatic > before.cyclomatic;
}

/** Compares the functions outside test files. Functions match by file and qualified name, so a moved line is no change. */
export function compareSnapshots(base: Snapshot, head: Snapshot): Diff {
  const baseFunctions = base.functions.filter((fn) => !fn.is_test);
  const headFunctions = head.functions.filter((fn) => !fn.is_test);
  const baseByKey = new Map(baseFunctions.map((fn) => [key(fn), fn]));
  const introduced: DiffRow[] = [];
  const worse: DiffRow[] = [];
  const improved: DiffRow[] = [];
  for (const fn of headFunctions) {
    const before = baseByKey.get(key(fn));
    if (!before) {
      if (isAboveLimits(fn)) {
        introduced.push(toRow(fn, before));
      }
    } else if (isAboveLimits(fn) && grew(fn, before)) {
      worse.push(toRow(fn, before));
    } else if (isAboveLimits(before) && !isAboveLimits(fn)) {
      improved.push(toRow(fn, before));
    }
  }
  return {
    base_sha: base.sha,
    head_sha: head.sha,
    above_limits: { base: baseFunctions.filter(isAboveLimits).length, head: headFunctions.filter(isAboveLimits).length },
    introduced: introduced.sort(byComplexity),
    worse: worse.sort(byComplexity),
    improved: improved.sort(byComplexity),
  };
}

function expectNullableCount(value: unknown, field: string): number | null {
  return value === null ? null : expectCount(value, field);
}

function parseTotals(value: unknown, field: string): Totals {
  const totals = expectObject(value, field);
  return { base: expectCount(totals['base'], `${field}.base`), head: expectCount(totals['head'], `${field}.head`) };
}

function parseRow(value: unknown, list: string, index: number): DiffRow {
  const field = `${list}[${index}]`;
  const row = expectObject(value, field);
  return {
    file: expectString(row['file'], `${field}.file`),
    qualified_name: expectString(row['qualified_name'], `${field}.qualified_name`),
    line: expectCount(row['line'], `${field}.line`),
    cognitive: expectCount(row['cognitive'], `${field}.cognitive`),
    cyclomatic: expectCount(row['cyclomatic'], `${field}.cyclomatic`),
    base_cognitive: expectNullableCount(row['base_cognitive'], `${field}.base_cognitive`),
    base_cyclomatic: expectNullableCount(row['base_cyclomatic'], `${field}.base_cyclomatic`),
  };
}

function parseRows(value: unknown, field: string): DiffRow[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value.map((row, index) => parseRow(row, field, index));
}

/** Checks the shape of a diff that comes from untrusted code, and keeps only the known fields. */
export function parseDiff(value: unknown): Diff {
  const diff = expectObject(value, 'diff');
  return {
    base_sha: expectSha(diff['base_sha'], 'base_sha'),
    head_sha: expectSha(diff['head_sha'], 'head_sha'),
    above_limits: parseTotals(diff['above_limits'], 'above_limits'),
    introduced: parseRows(diff['introduced'], 'introduced'),
    worse: parseRows(diff['worse'], 'worse'),
    improved: parseRows(diff['improved'], 'improved'),
  };
}

function scoreCell(score: number, baseScore: number | null, limit: number): string {
  const value = score > limit ? `**${score}**` : String(score);
  if (baseScore === null) {
    return `${value} (new)`;
  }
  const delta = score - baseScore;
  if (delta === 0) {
    return `${value} (±0)`;
  }
  return `${value} (${delta > 0 ? '+' : '−'}${Math.abs(delta)})`;
}

function section(title: string, rows: DiffRow[], note?: string): string[] {
  if (rows.length === 0) {
    return [];
  }
  const lines = [
    `**${title} (${rows.length})**`,
    '',
    '| Function | Cognitive | Cyclomatic |',
    '| --- | ---: | ---: |',
    ...rows.slice(0, MAX_ROWS).map((row) => [
      `| ${codeSpan(row.qualified_name)}<br>${codeSpan(`${row.file}:${row.line}`)}`,
      scoreCell(row.cognitive, row.base_cognitive, LIMITS.cognitive),
      `${scoreCell(row.cyclomatic, row.base_cyclomatic, LIMITS.cyclomatic)} |`,
    ].join(' | ')),
    '',
  ];
  if (rows.length > MAX_ROWS) {
    lines.push(`${rows.length - MAX_ROWS} more functions are not shown.`, '');
  }
  if (note) {
    lines.push(note, '');
  }
  return lines;
}

function remaining(count: number): string {
  if (count === 0) {
    return 'No function is above the limits.';
  }
  return `${count} ${count === 1 ? 'function is' : 'functions are'} above the limits in total.`;
}

/** Renders the sticky PR comment. Every string from the snapshots goes through `codeSpan`. */
export function renderMarkdown(diff: Diff): string {
  const header = [
    MARKER,
    '### Complexity',
    '',
    `Compared with the merge base ${codeSpan(diff.base_sha.slice(0, 7))} for ${codeSpan(diff.head_sha.slice(0, 7))}.`,
    '',
  ];
  const footer = `<sub>Limits: cognitive ${LIMITS.cognitive}, cyclomatic ${LIMITS.cyclomatic}. A bold score is above its limit. Test files are not counted.</sub>`;
  const total = diff.above_limits.head;
  if (diff.introduced.length === 0 && diff.worse.length === 0 && diff.improved.length === 0) {
    const old = total === 0 ? 'No function is above the limits.' : `${total} old ${total === 1 ? 'violation remains' : 'violations remain'}.`;
    return [...header, `No function crossed the limits. ${old}`, '', footer, ''].join('\n');
  }
  return [
    ...header,
    ...section('New functions above the limits', diff.introduced),
    ...section('Existing functions above the limits that got worse', diff.worse),
    ...section(
      'Functions that dropped below the limits',
      diff.improved,
      'Run `npx eslint --prune-suppressions .` and commit the smaller `eslint-suppressions.json`.',
    ),
    remaining(total),
    '',
    footer,
    '',
  ].join('\n');
}
