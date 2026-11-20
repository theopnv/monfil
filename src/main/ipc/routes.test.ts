// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';
import { createCategory, createWorkspace } from '../db/crud/insert';
import { createSavedSearch, updateSavedSearch } from '../db/crud/searches';
import { updateWorkspace } from '../db/crud/update';
import { useTestDatabase } from '../test/db';
import { routes } from './routes';

vi.mock(import('../db/crud/update'), { spy: true });
vi.mock(import('../db/crud/searches'), { spy: true });


useTestDatabase();

afterEach(() => {
  vi.mocked(updateWorkspace).mockClear();
  vi.mocked(updateSavedSearch).mockClear();
});

describe('the feeds:list-categories route', () => {
  test('lists the categories of the workspace asked for only', async () => {
    // Arrange
    const created = await createWorkspace('Other', 'Home01', '#ffffff');
    if (!created.success) {
      throw new Error('expected the workspace to be created');
    }
    await createCategory('Home only', HOME_WORKSPACE_ID);
    await createCategory('Other only', created.data.id);

    // Act
    const categories = await routes['feeds:list-categories'].run({ workspaceId: created.data.id });

    // Assert
    expect(categories).toEqual([expect.objectContaining({ name: 'Other only', workspace_id: created.data.id })]);
  });
});


describe('the workspaces:update route', () => {
  const nothingElse = { name: 'Reading', icon: 'Book01', color: '#112233' };

  test.each([
    ['name', { name: 'Renamed' }],
    ['icon', { icon: 'Star01' }],
    ['color', { color: '#abcdef' }],
  ] as const)('changes only the %s that the request holds', async (_field, change) => {
    // Arrange
    const created = await createWorkspace(nothingElse.name, nothingElse.icon, nothingElse.color);
    if (!created.success) {
      throw new Error('expected the workspace to be created');
    }

    // Act
    const result = await routes['workspaces:update'].run({ workspaceId: created.data.id, ...change });

    // Assert
    expect(result).toEqual({ success: true, data: { ...created.data, ...change } });
    expect(vi.mocked(updateWorkspace).mock.calls[0]).toStrictEqual([created.data.id, change]);
  });

  test('changes all three fields when the request holds all three', async () => {
    // Arrange
    const created = await createWorkspace(nothingElse.name, nothingElse.icon, nothingElse.color);
    if (!created.success) {
      throw new Error('expected the workspace to be created');
    }
    const change = { name: 'Renamed', icon: 'Star01', color: '#abcdef' };

    // Act
    const result = await routes['workspaces:update'].run({ workspaceId: created.data.id, ...change });

    // Assert
    expect(result).toEqual({ success: true, data: { ...created.data, ...change } });
  });
});


describe('the searches:update route', () => {
  test.each([
    ['name', { name: 'Renamed' }],
    ['query', { query: 'title:other' }],
  ] as const)('changes only the %s that the request holds', async (_field, change) => {
    // Arrange
    const created = await createSavedSearch(HOME_WORKSPACE_ID, 'Engineers', 'title:engineer');
    if (!created.success) {
      throw new Error('expected the saved search to be created');
    }

    // Act
    const result = await routes['searches:update'].run({ searchId: created.data.id, ...change });

    // Assert
    expect(result).toEqual({ success: true, data: { ...created.data, ...change } });
    expect(vi.mocked(updateSavedSearch).mock.calls[0]).toStrictEqual([created.data.id, change]);
  });
});

