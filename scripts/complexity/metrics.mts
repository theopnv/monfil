import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@typescript-eslint/typescript-estree';
import { ESLint, type Linter } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';
import { findFunctionAt, nameFunctions, type FunctionNode } from './naming.mts';

export interface FunctionRecord {
  file: string;
  qualified_name: string;
  line: number;
  cyclomatic: number;
  cognitive: number;
  is_test: boolean;
}

export interface CollectResult {
  records: FunctionRecord[];
  warnings: string[];
}

export interface Snapshot {
  sha: string;
  date: string;
  functions: FunctionRecord[];
}

const COGNITIVE = '@sonarjs/cognitive-complexity';
const CYCLOMATIC = '@sonarjs/cyclomatic-complexity';
const TEST_FILE = /\.test\.tsx?$/;

// Inline config so that the current rules also measure old checkouts, whatever their own eslint.config says.
const CONFIG: Linter.Config[] = [
  { ignores: ['src/renderer/components/untitled-ui/**', 'src/renderer/routeTree.gen.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@sonarjs': sonarjs },
    rules: {
      [COGNITIVE]: ['error', 0],
      [CYCLOMATIC]: ['error', { threshold: 0 }],
    },
  },
];

/** Reads the score from a complexity message. The cyclomatic rule reports JSON, the cognitive rule reports text. */
export function parseScore(ruleId: string, message: string): number | null {
  if (ruleId === CYCLOMATIC) {
    try {
      const { cost } = JSON.parse(message) as { cost?: unknown };
      return typeof cost === 'number' ? cost : null;
    } catch {
      return null;
    }
  }
  if (ruleId === COGNITIVE) {
    const match = /Complexity from (\d+) to/.exec(message);
    return match ? Number(match[1]) : null;
  }
  return null;
}

interface Scores {
  cyclomatic?: number;
  cognitive?: number;
}

function assignScore(scores: Scores, message: Linter.LintMessage): boolean {
  const score = parseScore(message.ruleId ?? '', message.message);
  if (score === null) {
    return false;
  }
  if (message.ruleId === CYCLOMATIC) {
    scores.cyclomatic = score;
  } else {
    scores.cognitive = score;
  }
  return true;
}

async function fileRecords(result: ESLint.LintResult, root: string, warnings: string[]): Promise<FunctionRecord[]> {
  const file = path.relative(root, result.filePath).split(path.sep).join('/');
  const fatal = result.messages.find((message) => message.fatal);
  if (fatal) {
    throw new Error(`${file}:${fatal.line}: ${fatal.message}`);
  }
  const code = await readFile(result.filePath, 'utf8');
  const functions = nameFunctions(parse(code, { loc: true, range: true, jsx: file.endsWith('.tsx') }));
  const scores = new Map<FunctionNode, Scores>();
  // Disable comments for rules outside this config give "Definition for rule … was not found" messages.
  for (const message of result.messages.filter((m) => m.ruleId === COGNITIVE || m.ruleId === CYCLOMATIC)) {
    const fn = findFunctionAt(functions, { line: message.line, column: message.column - 1 });
    const entry = fn ? (scores.get(fn.node) ?? {}) : {};
    if (!fn || !assignScore(entry, message)) {
      warnings.push(`${file}:${message.line}:${message.column} unmatched ${message.ruleId}: ${message.message}`);
      continue;
    }
    scores.set(fn.node, entry);
  }
  return functions.flatMap((fn) => {
    const entry = scores.get(fn.node);
    if (entry?.cyclomatic === undefined) {
      warnings.push(`${file}:${fn.start.line} ${fn.qualifiedName} has no cyclomatic score`);
      return [];
    }
    return [{
      file,
      qualified_name: fn.qualifiedName,
      line: fn.start.line,
      cyclomatic: entry.cyclomatic,
      cognitive: entry.cognitive ?? 0,
      is_test: TEST_FILE.test(file),
    }];
  });
}

/** Measures every function in the `src/` tree of `root`. The cognitive rule skips functions that score 0. */
export async function collect(root: string): Promise<CollectResult> {
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: CONFIG });
  const results = await eslint.lintFiles(['src']);
  const warnings: string[] = [];
  const perFile = await Promise.all(results.map((result) => fileRecords(result, root, warnings)));
  const records = perFile.flat().sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line
    || a.qualified_name.localeCompare(b.qualified_name));
  return { records, warnings };
}

export function headCommit(root: string): { sha: string; date: string } {
  const [sha = '', date = ''] = execFileSync('git', ['-C', root, 'show', '-s', '--format=%H%n%cI', 'HEAD'], { encoding: 'utf8' })
    .trim()
    .split('\n');
  return { sha, date };
}

/** Measures the checkout at `root` and adds the sha and commit date of its HEAD. */
export async function snapshot(root: string): Promise<{ snapshot: Snapshot; warnings: string[] }> {
  const { records, warnings } = await collect(root);
  return { snapshot: { ...headCommit(root), functions: records }, warnings };
}
