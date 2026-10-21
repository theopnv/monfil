/** Rows bound as one JSON parameter for each statement. Far below the 2 MB value limit, and it keeps a batch at a few statements. */
export const CHUNK_SIZE = 500;

export function chunks<T>(items: T[], size: number = CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/** Adds up the rows that D1 reports as written for every statement of a batch. */
export function rowsWritten(results: D1Result[]): number {
  return results.reduce((total, result) => total + (result.meta.rows_written ?? 0), 0);
}
