export const COMPLEXITY_TABLES = ['complexity_functions', 'complexity_folder_summary'] as const;
export const COVERAGE_TABLES = ['coverage_files', 'coverage_folder_summary', 'coverage_tests'] as const;

export const CI_TABLES = ['ci_runs', 'ci_jobs', 'ci_steps', 'ci_step_groups', 'ci_test_suites', 'ci_test_exceptions'] as const;

/** Every table that a query route can expose. A route allows its own domain and refuses the others. */
export const KNOWN_TABLES: readonly string[] = [...COMPLEXITY_TABLES, ...COVERAGE_TABLES, ...CI_TABLES];
