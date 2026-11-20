import { describe, expect, it } from 'vitest';
import { clipError, summarizePlaywright, summarizeVitest } from './test-report.mts';

describe('summarizeVitest', () => {
  it('counts each state and lists the failed and flaky tests', () => {
    // Arrange
    const report = {
      tests: [
        { file: 'src/a.test.ts', title: 'passes', state: 'passed', retries: 0, error: '' },
        { file: 'src/a.test.ts', title: 'flakes', state: 'passed', retries: 1, error: 'timeout\nstack line' },
        { file: 'src/b.test.ts', title: 'breaks', state: 'failed', retries: 1, error: 'expected 1 to be 2' },
        { file: 'src/b.test.ts', title: 'waits', state: 'skipped', retries: 0, error: '' },
      ],
    };

    // Act
    const result = summarizeVitest(report);

    // Assert
    expect(result).toMatchObject({ tests: 4, passed: 2, failed: 1, skipped: 1, flaky: 1 });
    expect(result.exceptions).toEqual([
      { file: 'src/a.test.ts', title: 'flakes', status: 'flaky', retries: 1, error: 'timeout' },
      { file: 'src/b.test.ts', title: 'breaks', status: 'failed', retries: 1, error: 'expected 1 to be 2' },
    ]);
  });

  it('keeps a test that passed on the first try out of the exceptions', () => {
    // Act
    const result = summarizeVitest({ tests: [{ file: 'a', title: 'b', state: 'passed', retries: 0, error: '' }] });

    // Assert
    expect(result.exceptions).toEqual([]);
  });

  it('treats a missing retry count as no retry and fills an empty message', () => {
    // Act
    const result = summarizeVitest({ tests: [{ file: 'a.test.ts', title: 'b', state: 'failed' }] });

    // Assert
    expect(result.exceptions).toEqual([{ file: 'a.test.ts', title: 'b', status: 'failed', retries: 0, error: 'no message' }]);
  });

  it.each([
    ['a value that is not an object', 'nope'],
    ['a report without tests', {}],
    ['a test with an unknown state', { tests: [{ file: 'a', title: 'b', state: 'pending' }] }],
    ['a test that is not an object', { tests: [null] }],
  ])('refuses %s', (_label, value) => {
    // Act
    const summarize = () => summarizeVitest(value);

    // Assert
    expect(summarize).toThrow();
  });
});

describe('summarizePlaywright', () => {
  const failedFirst = { status: 'failed', retry: 0, error: { message: '\u001b[31mTimeout\u001b[39m 5000ms\nmore' } };

  it('walks nested suites and reads the status of each test', () => {
    // Arrange
    const report = {
      suites: [
        {
          title: 'feeds.spec.ts',
          specs: [{ title: 'adds a feed', file: 'feeds.spec.ts', tests: [{ status: 'expected', results: [{ status: 'passed' }] }] }],
          suites: [{
            title: 'import',
            specs: [
              { title: 'reads opml', file: 'feeds.spec.ts', tests: [{ status: 'flaky', results: [failedFirst, { status: 'passed', retry: 1 }] }] },
              { title: 'rejects', file: 'feeds.spec.ts', tests: [{ status: 'unexpected', results: [failedFirst, failedFirst] }] },
              { title: 'later', file: 'feeds.spec.ts', tests: [{ status: 'skipped', results: [] }] },
            ],
          }],
        },
      ],
    };

    // Act
    const result = summarizePlaywright(report);

    // Assert
    expect(result).toMatchObject({ tests: 4, passed: 2, failed: 1, skipped: 1, flaky: 1 });
    expect(result.exceptions).toEqual([
      { file: 'test/e2e/feeds.spec.ts', title: 'import > reads opml', status: 'flaky', retries: 1, error: 'Timeout 5000ms' },
      { file: 'test/e2e/feeds.spec.ts', title: 'import > rejects', status: 'failed', retries: 1, error: 'Timeout 5000ms' },
    ]);
  });

  it('counts a test of each project separately', () => {
    // Arrange
    const tests = [
      { projectName: 'parallel', status: 'expected', results: [{ status: 'passed' }] },
      { projectName: 'alone', status: 'expected', results: [{ status: 'passed' }] },
    ];

    // Act
    const result = summarizePlaywright({ suites: [{ title: 'a.spec.ts', specs: [{ title: 't', file: 'a.spec.ts', tests }] }] });

    // Assert
    expect(result.tests).toBe(2);
  });

  it('ignores a test with a status it does not know', () => {
    // Act
    const result = summarizePlaywright({ suites: [{ title: 'a', specs: [{ title: 't', file: 'a', tests: [{ status: 'weird', results: [] }] }] }] });

    // Assert
    expect(result.tests).toBe(0);
  });

  it('refuses a report without suites', () => {
    // Act
    const summarize = () => summarizePlaywright({ stats: {} });

    // Assert
    expect(summarize).toThrow();
  });
});

describe('clipError', () => {
  it('keeps the first line, drops terminal colors, and cuts a long line', () => {
    // Act
    const result = clipError(`\u001b[1mfirst ${'x'.repeat(400)}\u001b[22m\nsecond`);

    // Assert
    expect(result).toHaveLength(300);
    expect(result.startsWith('first x')).toBe(true);
  });
});
