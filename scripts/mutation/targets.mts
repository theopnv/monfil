/** The Vitest project whose tests try to kill the mutants of a file, named like the suites in `coverage_tests`. */
export type MutationSuite = 'unit' | 'integration';

export const MUTATION_SUITES: readonly MutationSuite[] = ['unit', 'integration'];

/** Every file that a full run mutates, for each suite. The exclusions match the coverage report. */
export const SUITE_GLOBS: Record<MutationSuite, string[]> = {
  unit: ['src/{main,preload,shared}/**/*.ts', '!src/**/*.{test,spec}.ts', '!src/**/*.d.ts'],
  integration: [
    'src/renderer/**/*.{ts,tsx}',
    '!src/renderer/**/*.{test,spec}.{ts,tsx}',
    '!src/renderer/**/*.d.ts',
    '!src/renderer/components/untitled-ui/**',
    '!src/renderer/routeTree.gen.ts',
  ],
};

const SOURCE = /^src\/(main|preload|shared|renderer)\/.+\.tsx?$/;
const EXCLUDED = [/\.(test|spec)\.tsx?$/, /\.d\.ts$/, /^src\/renderer\/components\/untitled-ui\//, /^src\/renderer\/routeTree\.gen\.ts$/];

/** Keeps the source files that a suite can mutate, and splits them by suite. Paths are relative to the repository root. */
export function splitTargets(files: readonly string[]): Record<MutationSuite, string[]> {
  const result: Record<MutationSuite, string[]> = { unit: [], integration: [] };
  for (const file of new Set(files.map((name) => name.replaceAll('\\', '/')))) {
    if (!SOURCE.test(file) || EXCLUDED.some((pattern) => pattern.test(file))) {
      continue;
    }
    result[file.startsWith('src/renderer/') ? 'integration' : 'unit'].push(file);
  }
  return result;
}
