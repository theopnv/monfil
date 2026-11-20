import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadReports } from './reports.mts';

let directory = '';

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'ci-reports-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function addReport(artifact: string, file: string, content: unknown): Promise<void> {
  await mkdir(path.join(directory, artifact), { recursive: true });
  await writeFile(path.join(directory, artifact, file), typeof content === 'string' ? content : JSON.stringify(content));
}

const VITEST = { tests: [{ file: 'a.test.ts', title: 't', state: 'passed', retries: 1, error: '' }] };
const PLAYWRIGHT = { suites: [{ title: 'a.spec.ts', specs: [{ title: 't', file: 'a.spec.ts', tests: [{ status: 'expected', results: [{ status: 'passed' }] }] }] }] };

describe('loadReports', () => {
  it('reads the Vitest and Playwright report of each artifact of the attempt', async () => {
    // Arrange
    await addReport('ci-report-2-unit-ubuntu-latest', 'unit.json', VITEST);
    await addReport('ci-report-2-e2e-macos-15-intel', 'e2e.json', PLAYWRIGHT);

    // Act
    const results = await loadReports(directory, 2, vi.fn());

    // Assert
    expect(results.map(({ suite, runner, report }) => [suite, runner, report.tests, report.flaky])).toEqual([
      ['e2e', 'macos-15-intel', 1, 0],
      ['unit', 'ubuntu-latest', 1, 1],
    ]);
  });

  it('skips the artifacts of another attempt and any other folder', async () => {
    // Arrange
    await addReport('ci-report-1-unit-ubuntu-latest', 'unit.json', VITEST);
    await addReport('test-result-ubuntu-latest', 'x.json', {});
    await addReport('ci-report-2-unit-bad name', 'unit.json', VITEST);

    // Act
    const results = await loadReports(directory, 2, vi.fn());

    // Assert
    expect(results).toEqual([]);
  });

  it('warns about a report that is not valid JSON, or is missing, and keeps the others', async () => {
    // Arrange
    await addReport('ci-report-1-unit-ubuntu-latest', 'unit.json', '{not json');
    await addReport('ci-report-1-integration-ubuntu-latest', 'other.json', VITEST);
    await addReport('ci-report-1-e2e-ubuntu-latest', 'e2e.json', PLAYWRIGHT);
    const warn = vi.fn();

    // Act
    const results = await loadReports(directory, 1, warn);

    // Assert
    expect(results.map((result) => result.suite)).toEqual(['e2e']);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipped the unit report of ubuntu-latest'));
  });

  it('returns nothing when the folder does not exist', async () => {
    // Act
    const results = await loadReports(path.join(directory, 'missing'), 1, vi.fn());

    // Assert
    expect(results).toEqual([]);
  });
});
