/** The response that a shields.io endpoint badge reads: https://shields.io/badges/endpoint-badge */
export interface ShieldsEndpoint {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
  /** How long shields.io keeps the badge. A new snapshot arrives at most once for each push to main. */
  cacheSeconds: number;
}

const CACHE_SECONDS = 3600;

const LATEST_SRC = `
SELECT lines_covered, lines_total FROM coverage_folder_summary
WHERE folder = 'src' AND suite = 'merged'
ORDER BY date DESC LIMIT 1`;

/** The same bands as the Stryker mutation score badge, so both badges read alike. */
export function badgeColor(percent: number): string {
  if (percent >= 80) {
    return 'brightgreen';
  }
  return percent >= 60 ? 'orange' : 'red';
}

/** Builds the badge from the line counts of the newest merged snapshot of `src`, or from no snapshot. */
export function coverageBadge(row: { lines_covered: number; lines_total: number } | null): ShieldsEndpoint {
  if (!row || row.lines_total === 0) {
    return { schemaVersion: 1, label: 'coverage', message: 'unknown', color: 'lightgrey', cacheSeconds: CACHE_SECONDS };
  }
  const percent = Math.round((1000 * row.lines_covered) / row.lines_total) / 10;
  return { schemaVersion: 1, label: 'coverage', message: `${percent.toFixed(1)}%`, color: badgeColor(percent), cacheSeconds: CACHE_SECONDS };
}

/** Reads the line coverage of the newest merged snapshot of `src`. The query is fixed, so the route takes no input. */
export async function readCoverageBadge(db: D1Database): Promise<ShieldsEndpoint> {
  return coverageBadge(await db.prepare(LATEST_SRC).first<{ lines_covered: number; lines_total: number }>());
}
