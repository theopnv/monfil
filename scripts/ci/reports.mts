import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { SuiteResult } from './snapshot.mts';
import { summarizePlaywright, summarizeVitest, type SuiteName } from './test-report.mts';

/** A Playwright report of a full suite is a few megabytes, and a pull request controls the file. */
const MAX_REPORT_BYTES = 50 * 1024 * 1024;

const ARTIFACT = /^ci-report-(\d+)-(unit|integration|e2e)-([A-Za-z0-9._-]+)$/;

const SUMMARIZE: Record<SuiteName, (value: unknown) => SuiteResult['report']> = {
  unit: summarizeVitest,
  integration: summarizeVitest,
  e2e: summarizePlaywright,
};

async function readReport(file: string): Promise<unknown> {
  if ((await stat(file)).size > MAX_REPORT_BYTES) {
    throw new Error('The report is too large.');
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Reads the folders that `actions/download-artifact` made for the artifacts of one attempt, named
 * `ci-report-<attempt>-<suite>-<runner>`. A report that cannot be read gives a warning and no result,
 * so one broken pull request report never stops the ingest of the timings.
 */
export async function loadReports(
  directory: string,
  attempt: number,
  warn: (message: string) => void,
): Promise<SuiteResult[]> {
  const names = await readdir(directory).catch(() => [] as string[]);
  const results: SuiteResult[] = [];
  for (const name of names.sort()) {
    const match = ARTIFACT.exec(name);
    if (!match || Number(match[1]) !== attempt) {
      continue;
    }
    const suite = match[2] as SuiteName;
    const runner = match[3] as string;
    try {
      results.push({ suite, runner, report: SUMMARIZE[suite](await readReport(path.join(directory, name, `${suite}.json`))) });
    } catch (error) {
      warn(`Skipped the ${suite} report of ${runner}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return results;
}
