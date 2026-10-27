// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useLayoutEffect, useRef } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useMarkReadOnScroll } from './useMarkReadOnScroll';

interface Card {
  id: string;
  height?: number;
}

const CARD_HEIGHT = 100;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const cards = (...ids: number[]): Card[] => ids.map((id) => ({ id: String(id) }));

// The scroller sits 300px down the page so that a card scrolled out of it is still inside the window.
function Harness({ items, markAllRead, enabled = true, initialScroll = 0 }: {
  items: Card[];
  markAllRead: (ids: number[]) => void;
  enabled?: boolean;
  initialScroll?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useMarkReadOnScroll(ref, enabled, markAllRead);
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = initialScroll;
    }
  }, [initialScroll]);
  return (
    <div ref={ref} data-testid="scroller" style={{ marginTop: 300, height: 200, overflow: 'auto' }}>
      <div>
        {items.map((card) => <div key={card.id} data-item-id={card.id} style={{ height: card.height ?? CARD_HEIGHT }} />)}
      </div>
    </div>
  );
}

test('marks the cards that scrolled above the area in one call, and not the card that is still partly visible', async () => {
  // Arrange
  const markAllRead = vi.fn();
  const { getByTestId } = await render(<Harness items={cards(10, 11, 12, 13, 14, 15)} markAllRead={markAllRead} />);
  const scroller = getByTestId('scroller').element();

  // Act
  scroller.scrollTop = 150;
  await sleep(100);
  scroller.scrollTop = 250;

  // Assert
  expect(markAllRead).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
  expect(markAllRead).toHaveBeenCalledWith([10, 11]);
});

test('marks a card whose bottom edge is exactly on the top edge of the area', async () => {
  // Arrange
  const markAllRead = vi.fn();

  // Act
  await render(<Harness items={cards(10, 11, 12, 13, 14, 15)} markAllRead={markAllRead} initialScroll={CARD_HEIGHT} />);

  // Assert
  await vi.waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
  expect(markAllRead).toHaveBeenCalledWith([10]);
});

test('does not mark a card that has no height or an empty id', async () => {
  // Arrange
  const markAllRead = vi.fn();
  const items: Card[] = [{ id: '99', height: 0 }, { id: '' }, ...cards(10, 11, 12, 13, 14)];
  const { getByTestId } = await render(<Harness items={items} markAllRead={markAllRead} />);

  // Act
  getByTestId('scroller').element().scrollTop = 250;

  // Assert
  await vi.waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
  expect(markAllRead).toHaveBeenCalledWith([10]);
});

test('marks nothing while disabled, and scans the cards once it is enabled', async () => {
  // Arrange
  const markAllRead = vi.fn();
  const items = cards(10, 11, 12, 13, 14, 15);
  const { getByTestId, rerender } = await render(<Harness items={items} markAllRead={markAllRead} enabled={false} />);
  getByTestId('scroller').element().scrollTop = 250;
  await sleep(600);
  expect(markAllRead).not.toHaveBeenCalled();

  // Act
  await rerender(<Harness items={items} markAllRead={markAllRead} enabled />);

  // Assert
  await vi.waitFor(() => expect(markAllRead).toHaveBeenCalledWith([10, 11]));
});

test('marks cards that render after the first scan, even deep in the list', async () => {
  // Arrange
  const markAllRead = vi.fn();
  const { getByTestId, rerender } = await render(<Harness items={cards(10)} markAllRead={markAllRead} />);

  // Act
  await rerender(<Harness items={cards(10, 11, 12, 13, 14, 15)} markAllRead={markAllRead} />);
  getByTestId('scroller').element().scrollTop = 250;

  // Assert
  await vi.waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
  expect(markAllRead).toHaveBeenCalledWith([10, 11]);
});

test('sends the pending ids when the list unmounts, and sends nothing twice', async () => {
  // Arrange
  const markAllRead = vi.fn();
  const { getByTestId, unmount } = await render(<Harness items={cards(10, 11, 12, 13, 14, 15)} markAllRead={markAllRead} />);
  getByTestId('scroller').element().scrollTop = 150;
  await sleep(100);

  // Act
  await unmount();

  // Assert
  expect(markAllRead).toHaveBeenCalledTimes(1);
  expect(markAllRead).toHaveBeenCalledWith([10]);
  await sleep(500);
  expect(markAllRead).toHaveBeenCalledTimes(1);
});

test('does not send an id again when the list unmounts after a flush', async () => {
  // Arrange
  const markAllRead = vi.fn();
  const { getByTestId, unmount } = await render(<Harness items={cards(10, 11, 12, 13, 14, 15)} markAllRead={markAllRead} />);
  getByTestId('scroller').element().scrollTop = 150;
  await vi.waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));

  // Act
  await unmount();

  // Assert
  expect(markAllRead).toHaveBeenCalledTimes(1);
});

test('stops watching the cards once it is disabled', async () => {
  // Arrange
  const markAllRead = vi.fn();
  const { getByTestId, rerender } = await render(<Harness items={cards(10, 11, 12, 13, 14, 15)} markAllRead={markAllRead} />);
  const scroller = getByTestId('scroller').element();
  scroller.scrollTop = 150;
  await sleep(100);

  // Act
  await rerender(<Harness items={cards(10, 11, 12, 13, 14, 15)} markAllRead={markAllRead} enabled={false} />);
  await rerender(<Harness items={cards(10, 11, 12, 13, 14, 15, 16)} markAllRead={markAllRead} enabled={false} />);
  scroller.scrollTop = 400;
  await sleep(700);

  // Assert
  expect(markAllRead.mock.calls).toEqual([[[10]]]);
});
