// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useLayoutEffect, useRef } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { useMasonryRows } from './useMasonryRows';

function Masonry({ heights, enabled = true }: { heights: number[]; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useMasonryRows(ref, enabled);
  return (
    <div
      ref={ref}
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1px', alignItems: 'start', columnGap: 10, width: 400 }}
    >
      {heights.map((height, index) => <div key={index} data-testid={`card-${index}`} style={{ height }} />)}
    </div>
  );
}

test('moves a card up into the gap under a shorter card', async () => {
  // Arrange
  const heights = [100, 300, 100];

  // Act
  const { getByTestId } = await render(<Masonry heights={heights} />);

  // Assert
  const rect = (index: number) => getByTestId(`card-${index}`).element().getBoundingClientRect();
  await expect.poll(() => rect(2).top - rect(0).bottom).toBe(10);
  expect(rect(2).left).toBe(rect(0).left);
  expect(rect(2).top).toBeLessThan(rect(1).bottom);
});

test('places cards that render later', async () => {
  // Arrange
  const { getByTestId, rerender } = await render(<Masonry heights={[100, 300]} />);

  // Act
  await rerender(<Masonry heights={[100, 300, 100]} />);

  // Assert
  const rect = (index: number) => getByTestId(`card-${index}`).element().getBoundingClientRect();
  await expect.poll(() => rect(2).top - rect(0).bottom).toBe(10);
});

test('moves the cards below a card that grows', async () => {
  // Arrange
  const { getByTestId, rerender } = await render(<Masonry heights={[100, 300, 100]} />);
  const rect = (index: number) => getByTestId(`card-${index}`).element().getBoundingClientRect();
  await expect.poll(() => rect(2).top - rect(0).bottom).toBe(10);

  // Act
  await rerender(<Masonry heights={[200, 300, 100]} />);

  // Assert
  await expect.poll(() => rect(2).top - rect(0).bottom).toBe(10);
});

test('clears row spans when disabled', async () => {
  // Arrange
  const { getByTestId, rerender } = await render(<Masonry heights={[100, 300, 100]} />);
  await expect.poll(() => getByTestId('card-0').element().style.gridRowEnd).not.toBe('');

  // Act
  await rerender(<Masonry heights={[100, 300, 100]} enabled={false} />);

  // Assert
  expect(getByTestId('card-0').element().style.gridRowEnd).toBe('');
});

test('sizes the rows before a parent layout effect runs', async () => {
  // Arrange
  let heightSeenByParent = 0;
  function Parent() {
    const wrapper = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      heightSeenByParent = wrapper.current?.getBoundingClientRect().height ?? 0;
    }, []);
    return <div ref={wrapper}><Masonry heights={[100, 300, 100]} /></div>;
  }

  // Act
  await render(<Parent />);

  // Assert
  expect(heightSeenByParent).toBe(310);
});
