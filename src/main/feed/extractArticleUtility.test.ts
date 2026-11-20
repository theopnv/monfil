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

  test('resolves a request with the response of the process', async () => {
    // Arrange
    const result = extractArticleInUtilityProcess('<p>a</p>', 'https://example.com/a');

    // Act
    children[0]?.respond(children[0].sent[0]?.id ?? -1, 'first');

    // Assert
    await expect(result).resolves.toMatchObject({ text: 'first' });
  });

  test('rejects a request that takes longer than the timeout and kills the process', async () => {
    // Arrange
    const result = extractArticleInUtilityProcess('<p>a</p>', 'https://example.com/a');
    const rejection = expect(result).rejects.toThrow(/timed out/);

    // Act
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);

    // Assert
    await rejection;
    expect(children[0]?.killed).toBe(true);
  });

  test('does not time out a request that answers in time', async () => {
    // Arrange
    const result = extractArticleInUtilityProcess('<p>a</p>', 'https://example.com/a');
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS - 1);

    // Act
    children[0]?.respond(children[0].sent[0]?.id ?? -1, 'in time');
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);

    // Assert
    await expect(result).resolves.toMatchObject({ text: 'in time' });
    expect(children[0]?.killed).toBe(false);
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

  test('starts the timeout of a queued request when it reaches the front, not when it was queued', async () => {
    // Arrange
    const first = extractArticleInUtilityProcess('<p>first</p>', 'https://example.com/first');
    const second = extractArticleInUtilityProcess('<p>second</p>', 'https://example.com/second');
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS - 1);
    children[0]?.respond(children[0].sent[0]?.id ?? -1, 'first');
    await first;

    // Act
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS - 1);
    children[0]?.respond(children[0].sent[1]?.id ?? -1, 'second');

    // Assert
    await expect(second).resolves.toMatchObject({ text: 'second' });
    expect(children[0]?.killed).toBe(false);
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

  test('uses a new process for a request after a timeout', async () => {
    // Arrange
    const slow = extractArticleInUtilityProcess('<p>slow</p>', 'https://example.com/slow');
    const slowRejection = expect(slow).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(EXTRACTION_TIMEOUT_MS);
    await slowRejection;

    // Act
    const later = extractArticleInUtilityProcess('<p>later</p>', 'https://example.com/later');
    children[1]?.respond(children[1].sent[0]?.id ?? -1, 'later');

    // Assert
    await expect(later).resolves.toMatchObject({ text: 'later' });
    expect(children).toHaveLength(2);
  });
});
