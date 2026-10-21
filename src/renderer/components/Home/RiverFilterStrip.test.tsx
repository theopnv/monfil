// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { subscribeToAnnouncements } from '@/lib/announcer';
import RiverFilterStrip from './RiverFilterStrip';
import { HOME_WORKSPACE_ID, type FeedSummary } from '../../../shared/contracts';

function createFeed(id: number, overrides: Partial<FeedSummary> = {}): FeedSummary {
  return {
    id,
    link: `https://feed-${id}.example/feed`,
    title: `Feed ${id}`,
    type: 'rss',
    showInWorkspace: 1,
    workspaceId: HOME_WORKSPACE_ID,
    last_fetched_at: undefined,
    last_error: undefined,
    icon: undefined,
    category: { id: 1, name: 'Tech', workspace_id: HOME_WORKSPACE_ID },
    itemCount: 0,
    unreadCount: 0,
    otherWorkspaceCount: 0,
    ...overrides,
  };
}

const [feedOne, feedTwo, feedThree] = [createFeed(1), createFeed(2), createFeed(3)];
const hiddenFeed = createFeed(4, { showInWorkspace: 0 });
const feeds = [feedOne, feedTwo, feedThree, hiddenFeed];

describe('RiverFilterStrip', () => {
  test('renders nothing when no feed is focused or hidden', async () => {
    // Arrange
    const plain = [createFeed(1), createFeed(2)];

    // Act
    const { container } = await render(<RiverFilterStrip feeds={plain} showOnlyLinks={new Set()} onClearFocus={vi.fn()} onShowHidden={vi.fn()} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  test('counts the focused feeds against the feeds that are not hidden', async () => {
    // Act
    const { getByText } = await render(<RiverFilterStrip feeds={feeds} showOnlyLinks={new Set([feedOne.link, feedTwo.link])} onClearFocus={vi.fn()} onShowHidden={vi.fn()} />);

    // Assert
    await expect.element(getByText('Showing 2 of 3 feeds')).toBeInTheDocument();
  });

  test('counts the hidden feeds', async () => {
    // Act
    const { getByText } = await render(<RiverFilterStrip feeds={feeds} showOnlyLinks={new Set()} onClearFocus={vi.fn()} onShowHidden={vi.fn()} />);

    // Assert
    await expect.element(getByText('1 hidden feed', { exact: true })).toBeInTheDocument();
    await expect.element(getByText(/Showing/)).not.toBeInTheDocument();
  });

  test('uses the plural for several hidden feeds', async () => {
    // Arrange
    const manyHidden = [createFeed(1), createFeed(2, { showInWorkspace: 0 }), createFeed(3, { showInWorkspace: 0 })];

    // Act
    const { getByText } = await render(<RiverFilterStrip feeds={manyHidden} showOnlyLinks={new Set()} onClearFocus={vi.fn()} onShowHidden={vi.fn()} />);

    // Assert
    await expect.element(getByText('2 hidden feeds', { exact: true })).toBeInTheDocument();
  });

  test('ignores a focused link that matches no feed', async () => {
    // Act
    const { container } = await render(<RiverFilterStrip feeds={[createFeed(1)]} showOnlyLinks={new Set(['https://gone.example/feed'])} onClearFocus={vi.fn()} onShowHidden={vi.fn()} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  test('"Show all" clears the focus', async () => {
    // Arrange
    const onClearFocus = vi.fn();
    const onShowHidden = vi.fn();
    const { getByRole } = await render(<RiverFilterStrip feeds={feeds} showOnlyLinks={new Set([feedOne.link])} onClearFocus={onClearFocus} onShowHidden={onShowHidden} />);

    // Act
    await getByRole('button', { name: 'Show all feeds' }).click();

    // Assert
    expect(onClearFocus).toHaveBeenCalledOnce();
    expect(onShowHidden).not.toHaveBeenCalled();
  });

  test('"Show" reveals the hidden feeds and leaves the focus alone', async () => {
    // Arrange
    const onClearFocus = vi.fn();
    const onShowHidden = vi.fn();
    const { getByRole } = await render(<RiverFilterStrip feeds={feeds} showOnlyLinks={new Set([feedOne.link])} onClearFocus={onClearFocus} onShowHidden={onShowHidden} />);

    // Act
    await getByRole('button', { name: 'Show hidden feeds' }).click();

    // Assert
    expect(onShowHidden).toHaveBeenCalledWith([4]);
    expect(onClearFocus).not.toHaveBeenCalled();
  });

  test('each action is announced', async () => {
    // Arrange
    const announced: string[] = [];
    const unsubscribe = subscribeToAnnouncements((message) => announced.push(message));
    const { getByRole } = await render(<RiverFilterStrip feeds={feeds} showOnlyLinks={new Set([feedOne.link])} onClearFocus={vi.fn()} onShowHidden={vi.fn()} />);

    // Act
    await getByRole('button', { name: 'Show all feeds' }).click();
    await getByRole('button', { name: 'Show hidden feeds' }).click();

    // Assert
    unsubscribe();
    expect(announced).toEqual(['Showing all feeds.', 'Hidden feeds are shown again.']);
  });
});
