import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useFeedValidation } from './useFeedValidation';
import type { ParsedSource, FeedFetchError } from '../../../preload/channels';
import type { Result } from '../../../main/lib/utils';

const validFeed: ParsedSource = { type: 'rss', link: 'https://example.com/feed', title: 'Example Feed', description: 'An example feed', items: [] };
const notFoundError: FeedFetchError = { name: 'UNSUPPORTED_FORMAT', message: 'nope' };

function Probe({ query }: { query: string }) {
  const { status, feed, error } = useFeedValidation(query);
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="feed">{feed?.title ?? ''}</span>
      <span data-testid="error">{error?.message ?? ''}</span>
    </div>
  );
}

let invokeMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  invokeMock = vi.fn();
  window.electron = {
    ipcRenderer: {
      invoke: invokeMock,
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
  vi.useFakeTimers();
});

describe('useFeedValidation', () => {
  test('stays idle and never calls invoke while the query is empty', async () => {
    // Arrange
    const { getByTestId } = await render(<Probe query="   " />);

    // Act
    await vi.advanceTimersByTimeAsync(1000);

    // Assert
    await expect.element(getByTestId('status')).toHaveTextContent('idle');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('collapses rapid typing into a single call after the debounce window', async () => {
    // Arrange: real timers here (see the fake-timers memory note above `rerender` is a
    // synchronous in-page React update, not a round trip through the automation layer, so
    // back-to-back calls stay well under the debounce window regardless of other browser
    // instances competing for CPU — unlike sequential `.fill()`, which does go through it.
    // Mounts with an empty query: useDebouncedValue seeds its initial state to the mount
    // value with no delay, so mounting directly at "e" would fire once immediately and
    // once again after the debounce window.
    vi.useRealTimers();
    invokeMock.mockResolvedValue({ success: true, data: validFeed } satisfies Result<ParsedSource, FeedFetchError>);
    const { rerender } = await render(<Probe query="" />);

    // Act
    await rerender(<Probe query="e" />);
    await rerender(<Probe query="ex" />);
    await rerender(<Probe query="exa" />);
    await rerender(<Probe query="example.com/feed" />);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Assert
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('feeds:validate-feed-url', 'example.com/feed');
  });

  test('maps a successful validation to status "found"', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ success: true, data: validFeed } satisfies Result<ParsedSource, FeedFetchError>);
    const { getByTestId } = await render(<Probe query="example.com/feed" />);

    // Act
    await vi.advanceTimersByTimeAsync(450);

    // Assert
    await expect.element(getByTestId('status')).toHaveTextContent('found');
    await expect.element(getByTestId('feed')).toHaveTextContent('Example Feed');
  });

  test('maps a failed validation to status "not-found"', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ success: false, error: notFoundError } satisfies Result<ParsedSource, FeedFetchError>);
    const { getByTestId } = await render(<Probe query="not-a-feed.com" />);

    // Act
    await vi.advanceTimersByTimeAsync(450);

    // Assert
    await expect.element(getByTestId('status')).toHaveTextContent('not-found');
    await expect.element(getByTestId('error')).toHaveTextContent('nope');
  });

  test('ignores a stale response for an earlier query', async () => {
    // Arrange: the first call resolves slowly, the second resolves fast.
    let resolveFirst: (value: Result<ParsedSource, FeedFetchError>) => void = () => { };
    const firstCall = new Promise<Result<ParsedSource, FeedFetchError>>((resolve) => {
      resolveFirst = resolve;
    });
    invokeMock.mockReturnValueOnce(firstCall);
    invokeMock.mockResolvedValueOnce({ success: true, data: { ...validFeed, title: 'Second Feed' } });

    const { getByTestId, rerender } = await render(<Probe query="first.com" />);
    await vi.advanceTimersByTimeAsync(450);

    // Act: a new query fires and resolves before the first one does.
    await rerender(<Probe query="second.com" />);
    await vi.advanceTimersByTimeAsync(450);
    resolveFirst({ success: true, data: { ...validFeed, title: 'First Feed' } });
    await Promise.resolve();

    // Assert
    await expect.element(getByTestId('feed')).toHaveTextContent('Second Feed');
  });
});
