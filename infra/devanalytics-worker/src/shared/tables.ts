export const COMPLEXITY_TABLES = ['complexity_functions', 'complexity_folder_summary'] as const;
export const COVERAGE_TABLES = ['coverage_files', 'coverage_folder_summary'] as const;

/** Every table that a query route can expose. A route allows its own domain and refuses the others. */
export const KNOWN_TABLES: readonly string[] = [...COMPLEXITY_TABLES, ...COVERAGE_TABLES];
