import { describe, expect, it } from 'vitest';
import { parseQuery, QueryError } from '../src/shared/query.ts';
import { COMPLEXITY_TABLES, COVERAGE_TABLES } from '../src/shared/tables.ts';

describe('parseQuery', () => {
  it('accepts a query on an allowed table', () => {
    // Act
    const result = parseQuery({ sql: 'SELECT * FROM complexity_functions;' }, COMPLEXITY_TABLES);

    // Assert
    expect(result).toEqual({ sql: 'SELECT * FROM complexity_functions', params: [] });
  });

  it('does not match a longer name that only starts like a table', () => {
    // Act
    const result = parseQuery({ sql: 'SELECT coverage_files_count FROM x' }, COMPLEXITY_TABLES);

    // Assert
    expect(result.sql).toContain('coverage_files_count');
  });

  it.each([
    ['a table of another domain', 'SELECT * FROM coverage_files'],
    ['a double-quoted name', 'SELECT * FROM "coverage_files"'],
    ['a bracketed name', 'SELECT * FROM [coverage_files]'],
    ['a backtick name', 'SELECT * FROM `coverage_folder_summary`'],
    ['a name in mixed case', 'SELECT * FROM Coverage_Files'],
    ['a schema-qualified name', 'SELECT * FROM main.coverage_files'],
    ['a CTE that has the name of a table', 'WITH coverage_files AS (SELECT 1 AS n) SELECT n FROM coverage_files'],
    ['a sqlite_ table', 'SELECT name FROM sqlite_master'],
    ['a sqlite_ table in upper case', 'SELECT name FROM SQLITE_SCHEMA'],
  ])('refuses %s on the complexity route', (_label, sql) => {
    // Act
    const parse = () => parseQuery({ sql }, COMPLEXITY_TABLES);

    // Assert
    expect(parse).toThrow(QueryError);
  });

  it('refuses a complexity table on the coverage route', () => {
    // Act
    const parse = () => parseQuery({ sql: 'SELECT * FROM complexity_folder_summary' }, COVERAGE_TABLES);

    // Assert
    expect(parse).toThrow(QueryError);
  });

  it.each([
    ['a DELETE', 'DELETE FROM complexity_functions'],
    ['a second statement', 'SELECT 1; SELECT 2'],
    ['no SQL', ''],
  ])('refuses %s', (_label, sql) => {
    // Act
    const parse = () => parseQuery({ sql }, COMPLEXITY_TABLES);

    // Assert
    expect(parse).toThrow(QueryError);
  });
});
