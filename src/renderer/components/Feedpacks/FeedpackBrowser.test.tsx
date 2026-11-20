// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setRendererLanguage } from '@/lib/i18n';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import FeedpackBrowser from './FeedpackBrowser';
import type { Feedpack, FeedpackCatalog } from '../../../shared/contracts';

const translated: Feedpack = {
  slug: 'ai', title: 'AI', description: 'Research and news.', tags: ['llm'], curator: 'Monfil', sourceCount: 3, updatedAt: '2026-10-22', opml: 'ai.opml',
  i18n: { fr: { title: 'Intelligence artificielle', description: 'Recherche et actualités.' } },
};
const plain: Feedpack = { slug: 'ops', title: 'Operations', description: 'Run systems.', tags: [], curator: 'Monfil', sourceCount: 2, updatedAt: '2026-10-22', opml: 'ops.opml' };
const catalog: FeedpackCatalog = { version: 1, packs: [translated, plain] };

beforeEach(() => {
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn(() => Promise.resolve({ success: true, data: catalog })),
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

afterEach(async () => {
  await setRendererLanguage('en');
});

function renderBrowser() {
  return renderWithQueryClient(<FeedpackBrowser isActive selected={null} onSelect={vi.fn()} />);
}

describe('FeedpackBrowser', () => {
  test('lists the English title and description in English', async () => {
    // Act
    const { getByText } = await renderBrowser();

    // Assert
    await expect.element(getByText('Research and news.', { exact: true })).toBeInTheDocument();
    await expect.element(getByText('Run systems.', { exact: true })).toBeInTheDocument();
  });

  test('lists the translated title and description of a pack, and the English text of a pack with no translation', async () => {
    // Arrange
    await setRendererLanguage('fr');

    // Act
    const { getByText } = await renderBrowser();

    // Assert
    await expect.element(getByText('Intelligence artificielle', { exact: true })).toBeInTheDocument();
    await expect.element(getByText('Recherche et actualités.', { exact: true })).toBeInTheDocument();
    await expect.element(getByText('Operations', { exact: true })).toBeInTheDocument();
  });

  test.each([['artificielle'], ['actualités'], ['research'], ['llm']])('finds the pack by the word %j, in the translated or the English text', async (word) => {
    // Arrange
    await setRendererLanguage('fr');
    const { getByRole, getByText } = await renderBrowser();
    await expect.element(getByText('Operations', { exact: true })).toBeInTheDocument();

    // Act
    await getByRole('searchbox').fill(word);

    // Assert
    await expect.element(getByText('Intelligence artificielle', { exact: true })).toBeInTheDocument();
    await expect.element(getByText('Operations', { exact: true })).not.toBeInTheDocument();
  });
});
