export const LIMITS = { cognitive: 15, cyclomatic: 10 } as const;
export const MARKER = '<!-- complexity-report -->';
export const MAX_ROWS = 15;

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
  cognitive: Totals;
  cyclomatic: Totals;
  above_limits: Totals;
  new_above_limits: number;
  new_count: number;
  changed_count: number;
  removed_count: number;
  /** New and changed functions, the most complex first. */
  rows: DiffRow[];
}

const key = (fn: SnapshotFunction) => `${fn.file}\u0000${fn.qualified_name}`;
const sum = (functions: SnapshotFunction[], metric: 'cognitive' | 'cyclomatic') =>
  functions.reduce((total, fn) => total + fn[metric], 0);

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

/** Compares the functions outside test files. Functions match by file and qualified name, so a moved line is no change. */
export function compareSnapshots(base: Snapshot, head: Snapshot): Diff {
  const baseFunctions = base.functions.filter((fn) => !fn.is_test);
  const headFunctions = head.functions.filter((fn) => !fn.is_test);
  const baseByKey = new Map(baseFunctions.map((fn) => [key(fn), fn]));
  const headKeys = new Set(headFunctions.map(key));
  const rows: DiffRow[] = [];
  let newAboveLimits = 0;
  for (const fn of headFunctions) {
    const before = baseByKey.get(key(fn));
    if (before && before.cognitive === fn.cognitive && before.cyclomatic === fn.cyclomatic) {
      continue;
    }
    rows.push(toRow(fn, before));
    if (isAboveLimits(fn) && !(before && isAboveLimits(before))) {
      newAboveLimits += 1;
    }
  }
  const newCount = rows.filter((row) => row.base_cognitive === null).length;
  return {
    base_sha: base.sha,
    head_sha: head.sha,
    cognitive: { base: sum(baseFunctions, 'cognitive'), head: sum(headFunctions, 'cognitive') },
    cyclomatic: { base: sum(baseFunctions, 'cyclomatic'), head: sum(headFunctions, 'cyclomatic') },
    above_limits: { base: baseFunctions.filter(isAboveLimits).length, head: headFunctions.filter(isAboveLimits).length },
    new_above_limits: newAboveLimits,
    new_count: newCount,
    changed_count: rows.length - newCount,
    removed_count: baseFunctions.filter((fn) => !headKeys.has(key(fn))).length,
    rows: rows.sort(byComplexity),
  };
}

function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectCount(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value as number;
}

function expectNullableCount(value: unknown, field: string): number | null {
  return value === null ? null : expectCount(value, field);
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function expectSha(value: unknown, field: string): string {
  const sha = expectString(value, field);
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`${field} must be a commit sha`);
  }
  return sha;
}

function parseTotals(value: unknown, field: string): Totals {
  const totals = expectObject(value, field);
  return { base: expectCount(totals['base'], `${field}.base`), head: expectCount(totals['head'], `${field}.head`) };
}

function parseRow(value: unknown, index: number): DiffRow {
  const field = `rows[${index}]`;
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

/** Checks the shape of a diff that comes from untrusted code, and keeps only the known fields. */
export function parseDiff(value: unknown): Diff {
  const diff = expectObject(value, 'diff');
  if (!Array.isArray(diff['rows'])) {
    throw new Error('rows must be an array');
  }
  return {
    base_sha: expectSha(diff['base_sha'], 'base_sha'),
    head_sha: expectSha(diff['head_sha'], 'head_sha'),
    cognitive: parseTotals(diff['cognitive'], 'cognitive'),
    cyclomatic: parseTotals(diff['cyclomatic'], 'cyclomatic'),
    above_limits: parseTotals(diff['above_limits'], 'above_limits'),
    new_above_limits: expectCount(diff['new_above_limits'], 'new_above_limits'),
    new_count: expectCount(diff['new_count'], 'new_count'),
    changed_count: expectCount(diff['changed_count'], 'changed_count'),
    removed_count: expectCount(diff['removed_count'], 'removed_count'),
    rows: diff['rows'].map(parseRow),
  };
}

const MAX_CODE_LENGTH = 120;
// Line breaks, other control characters, and bidirectional overrides that could hide text.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Shows untrusted text as a code span, where GitHub renders no links, mentions or HTML.
 * A pipe would end the table cell even inside a code span, so it becomes a similar character.
 */
export function codeSpan(text: string): string {
  let clean = text.replace(UNSAFE_CHARACTERS, ' ').replaceAll('|', '∣');
  if (clean.length > MAX_CODE_LENGTH) {
    clean = `${clean.slice(0, MAX_CODE_LENGTH - 1)}…`;
  }
  const longestRun = Math.max(0, ...(clean.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  return `${fence} ${clean} ${fence}`;
}

const NUMBER = new Intl.NumberFormat('en-US');

function signed(delta: number): string {
  if (delta === 0) {
    return '±0';
  }
  return delta > 0 ? `+${NUMBER.format(delta)}` : `−${NUMBER.format(-delta)}`;
}

function totalLine(label: string, totals: Totals): string {
  return `${label} **${signed(totals.head - totals.base)}** (${NUMBER.format(totals.base)} → ${NUMBER.format(totals.head)})`;
}

function scoreCell(score: number, baseScore: number | null, limit: number): string {
  const value = score > limit ? `**${score}**` : String(score);
  if (baseScore === null) {
    return `${value} (new)`;
  }
  return `${value} (${signed(score - baseScore)})`;
}

function tableLines(rows: DiffRow[]): string[] {
  if (rows.length === 0) {
    return ['No function outside test files changed its complexity.'];
  }
  const lines = [
    '| Function | Cognitive | Cyclomatic |',
    '| --- | ---: | ---: |',
    ...rows.slice(0, MAX_ROWS).map((row) => [
      `| ${codeSpan(row.qualified_name)}<br>${codeSpan(`${row.file}:${row.line}`)}`,
      scoreCell(row.cognitive, row.base_cognitive, LIMITS.cognitive),
      `${scoreCell(row.cyclomatic, row.base_cyclomatic, LIMITS.cyclomatic)} |`,
    ].join(' | ')),
  ];
  if (rows.length > MAX_ROWS) {
    lines.push('', `${rows.length - MAX_ROWS} more changed functions are not shown.`);
  }
  return lines;
}

/** Renders the sticky PR comment. Every string from the snapshots goes through `codeSpan`. */
export function renderMarkdown(diff: Diff): string {
  const summary = [
    totalLine('Cognitive', diff.cognitive),
    totalLine('cyclomatic', diff.cyclomatic),
    `functions above the limits **${diff.above_limits.head}** (${diff.new_above_limits} new)`,
  ].join(', ');
  return [
    MARKER,
    '### Complexity',
    '',
    `Compared with the merge base ${codeSpan(diff.base_sha.slice(0, 7))} for ${codeSpan(diff.head_sha.slice(0, 7))}.`,
    '',
    `${summary}.`,
    '',
    `Functions: ${diff.new_count} new, ${diff.changed_count} changed, ${diff.removed_count} removed.`,
    '',
    ...tableLines(diff.rows),
    '',
    `<sub>Limits: cognitive ${LIMITS.cognitive}, cyclomatic ${LIMITS.cyclomatic}. A bold score is above its limit. Test files are not counted.</sub>`,
    '',
  ].join('\n');
}
