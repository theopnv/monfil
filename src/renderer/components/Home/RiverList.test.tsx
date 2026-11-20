// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { describeRiverCard } from '@/lib/river/utils';
import type { Density } from '@/lib/preferences';
import type { RiverRow } from '../../../shared/contracts';
import RiverList from './RiverList';

vi.mock(import('@/lib/river/utils'), { spy: true });
vi.mock(import('@/components/common/SaveButton'), () => ({ default: () => <></> }));

function row(id: number, overrides: Partial<RiverRow> = {}): RiverRow {
  return {
    id,
    title: `Item ${id}`,
    link: `https://example.com/item-${id}`,
    publishedAt: 1_000_000 - id,
    excerpt: '',
    feedTitle: 'Feed',
    feedLink: 'https://example.com/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    image: undefined,
    readAt: undefined,
    feedId: 1,
    type: 'rss',
    ...overrides,
  };
}

function renderedItemIds(): number[] {
  return vi.mocked(describeRiverCard).mock.calls.map(([item]) => item.id);
}

beforeEach(() => {
  vi.mocked(describeRiverCard).mockClear();
});

test.each(['Cards', 'Magazine', 'Compact'] as Density[])('%s draws again only the card of an item that changed', async (density) => {
  // Arrange
  const onOpen = vi.fn();
  const items = [row(1), row(2), row(3)];
  const { rerender } = await render(<RiverList items={items} density={density} onOpen={onOpen} />);
  vi.mocked(describeRiverCard).mockClear();

  // Act
  await rerender(<RiverList items={[items[0] as RiverRow, row(2, { readAt: '2024-01-01T00:00:00.000Z' }), items[2] as RiverRow]} density={density} onOpen={onOpen} />);

  // Assert
  expect(renderedItemIds()).toEqual([2]);
});

test.each(['Cards', 'Magazine', 'Compact'] as Density[])('%s draws no card again when the list is rebuilt from the same items', async (density) => {
  // Arrange
  const onOpen = vi.fn();
  const items = [row(1), row(2)];
  const { rerender } = await render(<RiverList items={items} density={density} onOpen={onOpen} />);
  vi.mocked(describeRiverCard).mockClear();

  // Act
  await rerender(<RiverList items={[...items]} density={density} onOpen={onOpen} />);

  // Assert
  expect(renderedItemIds()).toEqual([]);
});
