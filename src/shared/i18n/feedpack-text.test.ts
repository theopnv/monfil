// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import type { Feedpack } from '../contracts';
import { feedpackText } from './feedpack-text';

const pack: Feedpack = {
  slug: 'ai', title: 'AI', description: 'Research and news.', tags: [], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-10-22', opml: 'ai.opml',
  i18n: { fr: { title: 'IA', description: 'Recherche et actualités.' } },
};

describe('feedpackText', () => {

  test('gives the English text for a pack with no translations at all', () => {
    // Arrange
    const plain: Feedpack = { ...pack, i18n: undefined };

    // Act & Assert
    expect(feedpackText(plain, 'fr')).toEqual({ title: 'AI', description: 'Research and news.' });
  });

  test('gives the English text for English', () => {
    // Act & Assert
    expect(feedpackText(pack, 'en')).toEqual({ title: 'AI', description: 'Research and news.' });
  });
});
