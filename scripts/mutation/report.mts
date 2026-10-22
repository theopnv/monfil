import type { MutantResult, MutationTestResult } from 'mutation-testing-report-schema';

export const MAX_TEXT = 120;

const clip = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > MAX_TEXT ? `${line.slice(0, MAX_TEXT - 1)}…` : line;
};

/**
 * Lists the survivors that ran none of the tests that cover them. A Vitest name filter that matches nothing
 * gives this result, and so does stryker-js#6210 if `patches/` stops applying to the runner.
 */
export function falseSurvivors(report: MutationTestResult): { file: string; mutant: MutantResult }[] {
  return Object.entries(report.files).flatMap(([file, result]) => result.mutants
    .filter((mutant) => mutant.status === 'Survived' && (mutant.coveredBy?.length ?? 0) > 0 && mutant.testsCompleted === 0)
    .map((mutant) => ({ file, mutant })));
}

/** Reads the source text that a mutant replaces. Stryker's lines start at 1 and its columns at 1. */
export function originalText(source: string, { start, end }: MutantResult['location']): string {
  const lines = source.split('\n').slice(start.line - 1, end.line);
  if (lines.length === 0) {
    return '';
  }
  lines[lines.length - 1] = (lines.at(-1) ?? '').slice(0, end.column - 1);
  lines[0] = (lines[0] ?? '').slice(start.column - 1);
  return lines.join('\n');
}

/** A mutant that no test killed: it survived its tests, or no test runs its line. */
export interface Weakness {
  line: number;
  column: number;
  status: 'Survived' | 'NoCoverage';
  mutator: string;
  original: string;
  replacement: string;
}

export interface FileResult {
  file: string;
  killed: number;
  survived: number;
  noCoverage: number;
  /** `(killed + timeout) / (killed + timeout + survived + no coverage)`, in percent, or null without a valid mutant. */
  score: number | null;
  weaknesses: Weakness[];
}

export interface TestValue {
  file: string;
  name: string;
  /** Valid mutants whose code the test runs. */
  covered: number;
  killed: number;
  /** Mutants that this test kills and no other test does. */
  uniqueKills: number;
}

const DETECTED = new Set(['Killed', 'Timeout']);

function fileResult(file: string, source: string, mutants: readonly MutantResult[]): FileResult {
  const count = (status: string) => mutants.filter((mutant) => mutant.status === status).length;
  const detected = mutants.filter((mutant) => DETECTED.has(mutant.status)).length;
  const valid = detected + count('Survived') + count('NoCoverage');
  const weaknesses = mutants
    .filter((mutant): mutant is MutantResult & { status: Weakness['status'] } => mutant.status === 'Survived' || mutant.status === 'NoCoverage')
    .map((mutant) => ({
      line: mutant.location.start.line,
      column: mutant.location.start.column,
      status: mutant.status,
      mutator: mutant.mutatorName,
      original: clip(originalText(source, mutant.location)),
      replacement: clip(mutant.replacement ?? ''),
    }))
    .sort((a, b) => a.line - b.line || a.column - b.column);
  return { file, killed: detected, survived: count('Survived'), noCoverage: count('NoCoverage'), score: valid === 0 ? null : (100 * detected) / valid, weaknesses };
}

/** The result of each mutated file, with the most undetected mutants first. */
export function fileResults(report: MutationTestResult): FileResult[] {
  return Object.entries(report.files)
    .map(([file, { source, mutants }]) => fileResult(file, source, mutants))
    .sort((a, b) => (b.survived + b.noCoverage) - (a.survived + a.noCoverage) || a.file.localeCompare(b.file));
}

/** Counts the mutants that each test covers and kills. The kill counts are complete only for a run with `disableBail`. */
export function testValues(report: MutationTestResult, root: string = report.projectRoot ?? ''): TestValue[] {
  const tests = new Map<string, TestValue>();
  for (const [file, { tests: list }] of Object.entries(report.testFiles ?? {})) {
    const relative = root && file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
    for (const test of list) {
      tests.set(test.id, { file: relative, name: test.name, covered: 0, killed: 0, uniqueKills: 0 });
    }
  }
  for (const { mutants } of Object.values(report.files)) {
    for (const mutant of mutants) {
      if (mutant.status === 'CompileError' || mutant.status === 'RuntimeError' || mutant.status === 'Ignored') {
        continue;
      }
      mutant.coveredBy?.forEach((id) => {
        const test = tests.get(id);
        if (test) {
          test.covered += 1;
        }
      });
      const killers = mutant.killedBy ?? [];
      killers.forEach((id) => {
        const test = tests.get(id);
        if (test) {
          test.killed += 1;
          test.uniqueKills += killers.length === 1 ? 1 : 0;
        }
      });
    }
  }
  return [...tests.values()];
}
