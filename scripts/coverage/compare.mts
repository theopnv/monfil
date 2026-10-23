import { codeSpan } from '../complexity/compare.mts';
import type { Count, FileSummary, Snapshot } from './maps.mts';

export const MARKER = '<!-- coverage-report -->';
export const MAX_ROWS = 15;
export const SUITES = ['merged', 'vitest', 'e2e'] as const;
export type SuiteName = (typeof SUITES)[number];

export interface Totals {
  /** Null when there is no base to compare with. */
  base: Count | null;
  head: Count;
}

export interface FileRow {
  file: string;
  lines: Count;
  base_lines: Count | null;
}

export interface Diff {
  /** Null when the database has no row to compare with. */
  base_sha: string | null;
  head_sha: string;
  merge_base_sha: string;
  suites: Record<SuiteName, { lines: Totals; branches: Totals }>;
  /** Changed `src/` files that the head run knows, the least covered first. */
  files: FileRow[];
}

function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectCount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
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

function expectPair(value: unknown, field: string): Count {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${field} must be a pair of covered and total`);
  }
  const covered = expectCount(value[0], `${field}[0]`);
  const total = expectCount(value[1], `${field}[1]`);
  if (covered > total) {
    throw new Error(`${field} covers more than its total`);
  }
  return [covered, total];
}

function parseFileSummary(value: unknown, field: string): FileSummary {
  const entry = expectObject(value, field);
  const pair = (metric: 'lines' | 'statements' | 'functions' | 'branches') => expectPair(entry[metric], `${field}.${metric}`);
  return {
    file: expectString(entry['file'], `${field}.file`),
    lines: pair('lines'),
    statements: pair('statements'),
    functions: pair('functions'),
    branches: pair('branches'),
  };
}

function parseSuite(value: unknown, field: string): FileSummary[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value.map((entry, index) => parseFileSummary(entry, `${field}[${index}]`));
}

/** Checks a snapshot from untrusted code, and keeps only the known fields. */
export function parseSnapshot(value: unknown): Snapshot {
  const snapshot = expectObject(value, 'snapshot');
  const suites = expectObject(snapshot['suites'], 'suites');
  return {
    sha: expectSha(snapshot['sha'], 'sha'),
    date: expectString(snapshot['date'], 'date'),
    suites: {
      vitest: parseSuite(suites['vitest'], 'suites.vitest'),
      e2e: parseSuite(suites['e2e'], 'suites.e2e'),
      merged: parseSuite(suites['merged'], 'suites.merged'),
    },
  };
}

/** Rebuilds a snapshot from the rows of `SELECT * FROM coverage_files WHERE sha = ?`. Returns null when there are no rows. */
export function snapshotFromRows(value: unknown): Snapshot | null {
  const rows = expectObject(value, 'response')['rows'];
  if (!Array.isArray(rows)) {
    throw new Error('rows must be an array');
  }
  if (rows.length === 0) {
    return null;
  }
  const suites: Snapshot['suites'] = { vitest: [], e2e: [], merged: [] };
  let sha = '';
  let date = '';
  rows.forEach((value: unknown, index) => {
    const row = expectObject(value, `rows[${index}]`);
    const suite = row['suite'];
    if (suite !== 'vitest' && suite !== 'e2e' && suite !== 'merged') {
      throw new Error(`rows[${index}].suite is not a suite`);
    }
    sha = expectSha(row['sha'], `rows[${index}].sha`);
    date = expectString(row['date'], `rows[${index}].date`);
    const pair = (name: string): Count => expectPair([row[`${name}_covered`], row[`${name}_total`]], `rows[${index}].${name}`);
    suites[suite].push({
      file: expectString(row['file'], `rows[${index}].file`),
      lines: pair('lines'),
      statements: pair('statements'),
      functions: pair('functions'),
      branches: pair('branches'),
    });
  });
  return { sha, date, suites };
}

function sum(files: FileSummary[], metric: 'lines' | 'branches'): Count {
  return files.reduce<Count>((total, file) => [total[0] + file[metric][0], total[1] + file[metric][1]], [0, 0]);
}

export interface CompareOptions {
  mergeBaseSha: string;
  /** Repository-relative paths that the PR changes. */
  changedFiles: string[];
}

function ratio(count: Count): number {
  return count[1] === 0 ? 1 : count[0] / count[1];
}

/** Compares the suites, and lists the changed files of the head run that lost line coverage. `base` is null when no stored run exists. */
export function compareSnapshots(base: Snapshot | null, head: Snapshot, options: CompareOptions): Diff {
  const suites = {} as Diff['suites'];
  for (const name of SUITES) {
    suites[name] = {
      lines: { base: base ? sum(base.suites[name], 'lines') : null, head: sum(head.suites[name], 'lines') },
      branches: { base: base ? sum(base.suites[name], 'branches') : null, head: sum(head.suites[name], 'branches') },
    };
  }
  const baseByFile = new Map((base?.suites.merged ?? []).map((file) => [file.file, file.lines]));
  const changed = new Set(options.changedFiles);
  const files = head.suites.merged
    .filter((file) => changed.has(file.file) && file.file.startsWith('src/'))
    .filter((file) => {
      const before = baseByFile.get(file.file);
      return before !== undefined && ratio(file.lines) < ratio(before);
    })
    .map((file) => ({ file: file.file, lines: file.lines, base_lines: baseByFile.get(file.file) ?? null }))
    .sort((a, b) => ratio(a.lines) - ratio(b.lines) || a.file.localeCompare(b.file));
  return { base_sha: base?.sha ?? null, head_sha: head.sha, merge_base_sha: options.mergeBaseSha, suites, files };
}

function parseTotals(value: unknown, field: string): Totals {
  const totals = expectObject(value, field);
  return {
    base: totals['base'] === null ? null : expectPair(totals['base'], `${field}.base`),
    head: expectPair(totals['head'], `${field}.head`),
  };
}

/** Checks the shape of a diff before it becomes Markdown, and keeps only the known fields. */
export function parseDiff(value: unknown): Diff {
  const diff = expectObject(value, 'diff');
  const suites = expectObject(diff['suites'], 'suites');
  const files = diff['files'];
  if (!Array.isArray(files)) {
    throw new Error('files must be an array');
  }
  const parsedSuites = {} as Diff['suites'];
  for (const name of SUITES) {
    const suite = expectObject(suites[name], `suites.${name}`);
    parsedSuites[name] = { lines: parseTotals(suite['lines'], `suites.${name}.lines`), branches: parseTotals(suite['branches'], `suites.${name}.branches`) };
  }
  return {
    base_sha: diff['base_sha'] === null ? null : expectSha(diff['base_sha'], 'base_sha'),
    head_sha: expectSha(diff['head_sha'], 'head_sha'),
    merge_base_sha: expectSha(diff['merge_base_sha'], 'merge_base_sha'),
    suites: parsedSuites,
    files: files.map((value: unknown, index) => {
      const row = expectObject(value, `files[${index}]`);
      return {
        file: expectString(row['file'], `files[${index}].file`),
        lines: expectPair(row['lines'], `files[${index}].lines`),
        base_lines: row['base_lines'] === null ? null : expectPair(row['base_lines'], `files[${index}].base_lines`),
      };
    }),
  };
}

const NUMBER = new Intl.NumberFormat('en-US');

function percent(count: Count): string {
  return count[1] === 0 ? '–' : `${(ratio(count) * 100).toFixed(1)}%`;
}

function delta(totals: Totals): string {
  if (totals.base === null) {
    return '';
  }
  const points = Math.round((ratio(totals.head) - ratio(totals.base)) * 1000) / 10;
  if (points === 0) {
    return ' (±0.0)';
  }
  return points > 0 ? ` (+${points.toFixed(1)})` : ` (−${(-points).toFixed(1)})`;
}

function cell(totals: Totals): string {
  return `${percent(totals.head)}${delta(totals)} · ${NUMBER.format(totals.head[0])}/${NUMBER.format(totals.head[1])}`;
}

const SUITE_LABELS: Record<SuiteName, string> = { merged: 'Merged', vitest: 'Vitest', e2e: 'E2E' };

function baseNote(diff: Diff): string {
  const head = codeSpan(diff.head_sha.slice(0, 7));
  if (diff.base_sha === null) {
    return `No stored coverage to compare ${head} with.`;
  }
  const base = codeSpan(diff.base_sha.slice(0, 7));
  if (diff.base_sha === diff.merge_base_sha) {
    return `Compared with the merge base ${base} for ${head}.`;
  }
  return `The merge base ${codeSpan(diff.merge_base_sha.slice(0, 7))} has no stored coverage, so ${head} is compared with the latest earlier commit on main, ${base}.`;
}

function fileLines(files: FileRow[], hasBase: boolean): string[] {
  if (!hasBase) {
    return [];
  }
  if (files.length === 0) {
    return ['No changed file under `src/` lost line coverage.', ''];
  }
  return [
    '**Changed files that lost line coverage**',
    '',
    '| File | Lines |',
    '| --- | ---: |',
    ...files.slice(0, MAX_ROWS).map((row) => `| ${codeSpan(row.file)} | ${cell({ base: row.base_lines, head: row.lines })} |`),
    '',
    ...(files.length > MAX_ROWS ? [`${files.length - MAX_ROWS} more changed files are not shown.`, ''] : []),
  ];
}

/** Renders the sticky PR comment. Every path goes through `codeSpan`, and every number comes from a checked count. */
export function renderMarkdown(diff: Diff): string {
  return [
    MARKER,
    '### Coverage',
    '',
    baseNote(diff),
    '',
    '| Suite | Lines | Branches |',
    '| --- | ---: | ---: |',
    ...SUITES.map((name) => `| ${SUITE_LABELS[name]} | ${cell(diff.suites[name].lines)} | ${cell(diff.suites[name].branches)} |`),
    '',
    ...fileLines(diff.files, diff.base_sha !== null),
    '<sub>The change in each cell is in percentage points. Merged joins the Vitest and e2e runs. Preload code runs in an isolated world, so only the Vitest run counts it.</sub>',
    '',
  ].join('\n');
}
