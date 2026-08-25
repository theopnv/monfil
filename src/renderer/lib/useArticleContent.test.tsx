import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useArticleContent } from './useArticleContent';
import type { ArticleContentResult } from '../../preload/channels';

function Probe({ itemId }: { itemId: number | undefined }) {
  const state = useArticleContent(itemId);
  return (
    <div>
      <span data-testid="state">{state.state}</span>
      <span data-testid="html">{state.state === 'ready' ? state.html : ''}</span>
      <span data-testid="word-count">{state.state === 'ready' ? state.wordCount : ''}</span>
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
});

describe('useArticleContent', () => {
  test('starts loading, then becomes ready on an "ok" result', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ status: 'ok', html: '<p>Body</p>', wordCount: 3 } satisfies ArticleContentResult);

    // Act
    const { getByTestId } = await render(<Probe itemId={1} />);

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('items:get-content', 1);
    await expect.element(getByTestId('state')).toHaveTextContent('ready');
    await expect.element(getByTestId('html')).toHaveTextContent('Body');
    await expect.element(getByTestId('word-count')).toHaveTextContent('3');
  });

  test('becomes unavailable on an "unavailable" result', async () => {
    // Arrange
    invokeMock.mockResolvedValue({ status: 'unavailable' } satisfies ArticleContentResult);

    // Act
    const { getByTestId } = await render(<Probe itemId={1} />);

    // Assert
    await expect.element(getByTestId('state')).toHaveTextContent('unavailable');
  });

  test('becomes unavailable when the invoke call rejects', async () => {
    // Arrange
    invokeMock.mockRejectedValue(new Error('ipc failure'));

    // Act
    const { getByTestId } = await render(<Probe itemId={1} />);

    // Assert
    await expect.element(getByTestId('state')).toHaveTextContent('unavailable');
  });

  test('stays unavailable and never invokes when there is no item', async () => {
    // Act
    const { getByTestId } = await render(<Probe itemId={undefined} />);

    // Assert
    await expect.element(getByTestId('state')).toHaveTextContent('unavailable');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('drops a stale response for an item that is no longer current', async () => {
    // Arrange: the first item's fetch resolves slowly, the second resolves fast.
    let resolveFirst: (value: ArticleContentResult) => void = () => {};
    const firstCall = new Promise<ArticleContentResult>((resolve) => {
      resolveFirst = resolve;
    });
    invokeMock.mockReturnValueOnce(firstCall);
    invokeMock.mockResolvedValueOnce({ status: 'ok', html: '<p>Second</p>', wordCount: 1 } satisfies ArticleContentResult);

    const { getByTestId, rerender } = await render(<Probe itemId={1} />);

    // Act: item 2 fires and resolves before item 1's slow fetch does.
    await rerender(<Probe itemId={2} />);
    await expect.element(getByTestId('html')).toHaveTextContent('Second');
    resolveFirst({ status: 'ok', html: '<p>First</p>', wordCount: 1 });
    await Promise.resolve();

    // Assert
    await expect.element(getByTestId('html')).toHaveTextContent('Second');
  });
});
