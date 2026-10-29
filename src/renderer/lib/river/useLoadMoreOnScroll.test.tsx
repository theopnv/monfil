// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useRef } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useLoadMoreOnScroll } from './useLoadMoreOnScroll';

const VIEWPORT = 200;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function Harness({ contentHeight, loadMore, canLoadMore = true }: {
  contentHeight: number;
  loadMore: () => void;
  canLoadMore?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLoadMoreOnScroll(ref, loadMore, canLoadMore);
  return (
    <div ref={ref} data-testid="scroller" style={{ height: VIEWPORT, overflow: 'auto' }}>
      <div style={{ height: contentHeight }} />
    </div>
  );
}

test.each([
  { distance: 600, loads: true },
  { distance: 601, loads: false },
])('on mount, a list $distance px from its bottom loads more: $loads', async ({ distance, loads }) => {
  // Arrange
  const loadMore = vi.fn();

  // Act
  await render(<Harness contentHeight={VIEWPORT + distance} loadMore={loadMore} />);

  // Assert
  expect(loadMore).toHaveBeenCalledTimes(loads ? 1 : 0);
});

test.each([
  { distance: 600, loads: true },
  { distance: 601, loads: false },
])('on scroll, a list $distance px from its bottom loads more: $loads', async ({ distance, loads }) => {
  // Arrange
  const loadMore = vi.fn();
  const { getByTestId } = await render(<Harness contentHeight={3000} loadMore={loadMore} />);
  const scroller = getByTestId('scroller').element();

  // Act
  scroller.scrollTop = 3000 - VIEWPORT - distance;
  await sleep(100);

  // Assert
  expect(loadMore).toHaveBeenCalledTimes(loads ? 1 : 0);
});

test('does not load more when there is nothing more to load', async () => {
  // Arrange
  const loadMore = vi.fn();
  const { getByTestId } = await render(<Harness contentHeight={VIEWPORT} loadMore={loadMore} canLoadMore={false} />);

  // Act
  getByTestId('scroller').element().dispatchEvent(new Event('scroll'));
  await sleep(50);

  // Assert
  expect(loadMore).not.toHaveBeenCalled();
});

test('loads more as soon as there is more to load', async () => {
  // Arrange
  const loadMore = vi.fn();
  const { rerender } = await render(<Harness contentHeight={VIEWPORT} loadMore={loadMore} canLoadMore={false} />);

  // Act
  await rerender(<Harness contentHeight={VIEWPORT} loadMore={loadMore} canLoadMore />);

  // Assert
  expect(loadMore).toHaveBeenCalledTimes(1);
});

test('calls the latest loadMore after it changes', async () => {
  // Arrange
  const first = vi.fn();
  const second = vi.fn();
  const { getByTestId, rerender } = await render(<Harness contentHeight={VIEWPORT} loadMore={first} />);

  // Act
  await rerender(<Harness contentHeight={VIEWPORT} loadMore={second} />);
  getByTestId('scroller').element().dispatchEvent(new Event('scroll'));

  // Assert
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(2);
});

test('stops listening to scroll once the list unmounts', async () => {
  // Arrange
  const loadMore = vi.fn();
  const { getByTestId, unmount } = await render(<Harness contentHeight={VIEWPORT} loadMore={loadMore} />);
  const scroller = getByTestId('scroller').element();
  loadMore.mockClear();

  // Act
  await unmount();
  scroller.dispatchEvent(new Event('scroll'));

  // Assert
  expect(loadMore).not.toHaveBeenCalled();
});
