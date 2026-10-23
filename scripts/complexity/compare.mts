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
