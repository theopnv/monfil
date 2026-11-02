// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import MoveFeedDialog from './MoveFeedDialog';
import { HOME_WORKSPACE_ID, type FeedCategory, type FeedSummary, type WorkspaceSummary } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';

const feed: FeedSummary = {
  id: 1,
  link: 'https://a.example/feed',
  title: 'Feed A',
  type: 'rss',
  showInWorkspace: 1,
  workspaceId: HOME_WORKSPACE_ID,
  last_fetched_at: undefined,
  last_error: undefined,
  icon: undefined,
  category: { id: 1, name: 'Tech', workspace_id: HOME_WORKSPACE_ID },
  itemCount: 1,
  unreadCount: 1,
  otherWorkspaceCount: 0,
};

function workspace(id: number, name: string): WorkspaceSummary {
  return { id, name, icon: 'Home01', color: '#000000', position: id, source_slug: undefined, source_version: undefined, installed_at: undefined, hasUnread: false };
}

const destinationCategories: FeedCategory[] = [{ id: 10, name: 'News', workspace_id: 2 }];

let invokeMock: ReturnType<typeof vi.fn>;

function stubElectron(destination: FeedCategory[], moveResult: Result<void, { name: 'DB_ERROR'; message: string }> = { success: true, data: undefined }) {
  invokeMock = vi.fn((channel: string) => {
    switch (channel) {
      case 'workspaces:list':
        return Promise.resolve([workspace(HOME_WORKSPACE_ID, 'Home'), workspace(2, 'Work')]);
      case 'feeds:list-categories':
        return Promise.resolve(destination);
      case 'feeds:move-to-workspace':
        return Promise.resolve(moveResult);
      default:
        return Promise.resolve(undefined);
    }
  });
  window.electron = { ipcRenderer: { invoke: invokeMock, on: vi.fn(() => vi.fn()), sendMessage: vi.fn(), once: vi.fn() } } as unknown as typeof window.electron;
}

describe('MoveFeedDialog', () => {
  beforeEach(() => {
    stubElectron(destinationCategories);
  });

  test('moves the feed to the chosen folder of the other workspace', async () => {
    // Arrange
    const onOpenChange = vi.fn();
    const { getByRole } = await renderWithQueryClient(<MoveFeedDialog feed={feed} onOpenChange={onOpenChange} />);
    await expect.element(getByRole('option', { name: 'News' })).toBeInTheDocument();

    // Act
    await getByRole('combobox', { name: 'Folder' }).selectOptions('News');
    await getByRole('button', { name: 'Move feed' }).click();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('feeds:move-to-workspace', { feedId: 1, fromWorkspaceId: HOME_WORKSPACE_ID, toWorkspaceId: 2, categoryName: 'News' });
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test('defaults to a new folder named after the current folder when the destination has none like it', async () => {
    // Arrange
    const { getByRole } = await renderWithQueryClient(<MoveFeedDialog feed={feed} onOpenChange={vi.fn()} />);
    await expect.element(getByRole('option', { name: 'News' })).toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Move feed' }).click();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('feeds:move-to-workspace', { feedId: 1, fromWorkspaceId: HOME_WORKSPACE_ID, toWorkspaceId: 2, categoryName: 'Tech' });
  });

  test('shows the error and stays open when the move fails', async () => {
    // Arrange
    stubElectron(destinationCategories, { success: false, error: { name: 'DB_ERROR', message: 'Disk is full' } });
    const onOpenChange = vi.fn();
    const { getByRole, getByText } = await renderWithQueryClient(<MoveFeedDialog feed={feed} onOpenChange={onOpenChange} />);
    await expect.element(getByRole('option', { name: 'News' })).toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Move feed' }).click();

    // Assert
    await expect.element(getByText('Disk is full')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
