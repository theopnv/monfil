// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, expect, test } from 'vitest';
import { mainI18n, setMainLanguage } from './i18n';

afterEach(async () => {
  await setMainLanguage('en');
});

test('translates in English by default', () => {
  // Assert
  expect(mainI18n.language).toBe('en');
  expect(mainI18n.t('action.undo')).toBe('Undo');
});

test('uses the new language for the next call after a switch', async () => {
  // Act
  await setMainLanguage('fr');

  // Assert
  expect(mainI18n.language).toBe('fr');
});
