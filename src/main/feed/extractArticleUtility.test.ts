// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { utilityProcess } from 'electron';
import { ARTICLE_EXTRACTION_SERVICE_NAME, type ExtractArticleRequest } from './extractArticleProtocol';
import { EXTRACTION_TIMEOUT_MS, extractArticleInUtilityProcess, stopArticleExtractionProcess } from './extractArticleUtility';

vi.mock(import('electron'), () => ({ utilityProcess: { fork: vi.fn() } as unknown as typeof utilityProcess }));
vi.mock(import('../logging/logger'), () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() }, setDetailedLogging: vi.fn() }));

class FakeChild extends EventEmitter {
  readonly sent: ExtractArticleRequest[] = [];
  killed = false;

  postMessage(request: ExtractArticleRequest): void {
    this.sent.push(request);
  }

  kill(): boolean {
    this.killed = true;
    this.emit('exit', 1);
    return true;
  }

  respond(id: number, text: string): void {
    this.emit('message', { id, article: { html: `<p>${text}</p>`, text, wordCount: 1 } });
  }
}

let children: FakeChild[];

beforeEach(() => {
  vi.useFakeTimers();
  children = [];
  vi.mocked(utilityProcess.fork).mockImplementation((() => {
    const child = new FakeChild();
    children.push(child);
    return child;
  }) as unknown as typeof utilityProcess.fork);
});

afterEach(() => {
  stopArticleExtractionProcess();
  vi.useRealTimers();
});

describe('extractArticleInUtilityProcess', () => {
  test('names the utility process so the fatal handler can tell it apart', () => {
    // Act
    void extractArticleInUtilityProcess('<p>a</p>', 'https://example.com/a').catch(() => undefined);

    // Assert
    expect(utilityProcess.fork).toHaveBeenCalledWith(expect.stringContaining('extractArticleProcess.cjs'), [], { serviceName: ARTICLE_EXTRACTION_SERVICE_NAME });
  });

  test('sends the queued requests again to a new process after a timeout, and rejects only the slow one', async () => {
    // Arrange
    const slow = extractArticleInUtilityProcess('<p>slow</p>', 'https://example.com/slow');
    const next = extractArticleInUtilityProcess('<p>next</p>', 'https://example.com/next');
    const slowRejection = expect(slow).rejects.toThrow(/timed out/);

    // Act
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);
    await slowRejection;
    const restarted = children[1];
    const resent = restarted?.sent[0];
    restarted?.respond(resent?.id ?? -1, 'next');

    // Assert
    expect(resent).toMatchObject({ html: '<p>next</p>', url: 'https://example.com/next' });
    await expect(next).resolves.toMatchObject({ text: 'next' });
  });

  test('times out the next request as well when the restarted process stays silent', async () => {
    // Arrange
    const slow = extractArticleInUtilityProcess('<p>slow</p>', 'https://example.com/slow');
    const next = extractArticleInUtilityProcess('<p>next</p>', 'https://example.com/next');
    const rejections = Promise.all([expect(slow).rejects.toThrow(/timed out/), expect(next).rejects.toThrow(/timed out/)]);

    // Act
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);

    // Assert
    await rejections;
    expect(children[1]?.killed).toBe(true);
  });

  test('starts the timeout of the next request when the one in front answers', async () => {
    // Arrange
    const first = extractArticleInUtilityProcess('<p>first</p>', 'https://example.com/first');
    const second = extractArticleInUtilityProcess('<p>second</p>', 'https://example.com/second');
    const secondRejection = expect(second).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS - 1);
    children[0]?.respond(children[0].sent[0]?.id ?? -1, 'first');
    await first;

    // Act
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);

    // Assert
    await secondRejection;
    expect(children[0]?.killed).toBe(true);
  });

  test('a request queued later does not postpone the timeout of the one in front', async () => {
    // Arrange
    const first = extractArticleInUtilityProcess('<p>first</p>', 'https://example.com/first');
    const firstRejection = expect(first).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS - 1_000);
    const later = extractArticleInUtilityProcess('<p>later</p>', 'https://example.com/later');
    void later.catch(() => undefined);

    // Act
    await vi.advanceTimersByTimeAsync(1_000);

    // Assert
    await firstRejection;
  });

  test('rejects every request when the process exits on its own', async () => {
    // Arrange
    const first = extractArticleInUtilityProcess('<p>a</p>', 'https://example.com/a');
    const second = extractArticleInUtilityProcess('<p>b</p>', 'https://example.com/b');
    const rejections = Promise.all([expect(first).rejects.toThrow(/exited with code 9/), expect(second).rejects.toThrow(/exited with code 9/)]);

    // Act
    children[0]?.emit('exit', 9);

    // Assert
    await rejections;
  });

  test('starts no new process after a timeout when nothing is queued', async () => {
    // Arrange
    const slow = extractArticleInUtilityProcess('<p>slow</p>', 'https://example.com/slow');
    const slowRejection = expect(slow).rejects.toThrow(/timed out/);

    // Act
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);
    await slowRejection;

    // Assert
    expect(children).toHaveLength(1);
  });
});
