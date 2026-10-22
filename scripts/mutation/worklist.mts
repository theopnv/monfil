import type { MutationTestResult } from 'mutation-testing-report-schema';
import { fileResults, testValues, type FileResult, type TestValue, type Weakness } from './report.mts';
import type { MutationSuite } from './targets.mts';

/** Keeps the mutated files under one of the paths, so the test counts cover only those files. */
export function narrowReport(report: MutationTestResult, paths: readonly string[]): MutationTestResult {
  if (paths.length === 0) {
    return report;
  }
  const prefixes = paths.map((entry) => entry.replaceAll('\\', '/').replace(/\/+$/, ''));
  const keep = (file: string) => prefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`));
  return { ...report, files: Object.fromEntries(Object.entries(report.files).filter(([file]) => keep(file))) };
}

/** A Markdown code span that survives a backtick in the text. */
export function code(text: string): string {
  if (text === '') {
    return '(empty)';
  }
  return text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``;
}

const percent = (score: number | null) => (score === null ? 'n/a' : `${score.toFixed(1)}%`);

function weaknessLine(weakness: Weakness): string {
  const status = weakness.status === 'Survived' ? 'survived' : 'not covered';
  return `- L${weakness.line}:${weakness.column} ${weakness.mutator}, ${status}: ${code(weakness.original)} → ${code(weakness.replacement)}`;
}

function fileSection(result: FileResult): string[] {
  return [
    `### ${code(result.file)}: ${percent(result.score)}, ${result.survived} survived, ${result.noCoverage} not covered`,
    '',
    ...result.weaknesses.map(weaknessLine),
    '',
  ];
}

function byTestFile(tests: TestValue[], describe: (test: TestValue) => string): string[] {
  const groups = new Map<string, TestValue[]>();
  for (const test of tests) {
    groups.set(test.file, [...(groups.get(test.file) ?? []), test]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([file, list]) => [`- ${code(file)}`, ...list.map((test) => `  - ${test.name} (${describe(test)})`)]);
}

/** Renders the work list of one suite: the undetected mutants of each file, then the tests that add no detection. */
export function renderWorklist(suite: MutationSuite, report: MutationTestResult): string {
  const files = fileResults(report);
  const killed = files.reduce((sum, file) => sum + file.killed, 0);
  const survived = files.reduce((sum, file) => sum + file.survived, 0);
  const noCoverage = files.reduce((sum, file) => sum + file.noCoverage, 0);
  const valid = killed + survived + noCoverage;
  const tests = testValues(report).filter((test) => test.covered > 0);
  const killNothing = tests.filter((test) => test.killed === 0);
  const noUnique = tests.filter((test) => test.killed > 0 && test.uniqueKills === 0);
  const weak = files.filter((file) => file.weaknesses.length > 0);
  return [
    `## Suite ${code(suite)}`,
    '',
    `Score ${percent(valid === 0 ? null : (100 * killed) / valid)}: ${killed} detected, ${survived} survived, ${noCoverage} not covered, in ${files.length} files.`,
    `${tests.length} tests cover the mutated code. ${killNothing.length} kill no mutant. ${noUnique.length} kill only mutants that other tests also kill.`,
    '',
    '### Files with undetected mutants',
    '',
    ...(weak.length > 0 ? weak.flatMap(fileSection) : ['None.', '']),
    '### Tests that kill no mutant',
    '',
    'Each test runs mutated code, but no mutant makes it fail. Check what it asserts. A test that checks a rejection or an empty result can still guard a behavior that no mutant reaches.',
    '',
    ...(killNothing.length > 0 ? byTestFile(killNothing, (test) => `covers ${test.covered}`) : ['None.']),
    '',
    '### Tests without a unique kill',
    '',
    'Each mutant that these tests kill is also killed by another test. They are candidates to merge or remove, if a new run without them keeps the same kills.',
    '',
    ...(noUnique.length > 0 ? byTestFile(noUnique, (test) => `kills ${test.killed}`) : ['None.']),
    '',
  ].join('\n');
}
