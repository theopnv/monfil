// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { createI18n } from './create-i18n';

describe('createI18n', () => {
  test('translates a key at once, with no loading step', () => {
    // Act
    const i18n = createI18n('en');

    // Assert
    expect(i18n.t('action.undo')).toBe('Undo');
  });

  test('is initialized and has its namespace loaded on return', () => {
    // Act
    const i18n = createI18n('en');

    // Assert
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.hasLoadedNamespace('common')).toBe(true);
  });

  test('keeps interpolated values as they are, because React and the dialogs escape on their own', () => {
    // Arrange
    const i18n = createI18n('en');
    i18n.addResourceBundle('en', 'common', { greeting: 'Hi {{name}}' });

    // Act
    const text = i18n.t('greeting' as never, { name: '<b>Tom & Jerry</b>' });

    // Assert
    expect(text).toBe('Hi <b>Tom & Jerry</b>');
  });

  test('falls back to English for a key that a language lacks', () => {
    // Arrange
    const i18n = createI18n('fr');
    i18n.addResourceBundle('en', 'common', { onlyEnglish: 'Only English' });

    // Act
    const text = i18n.t('onlyEnglish' as never);

    // Assert
    expect(text).toBe('Only English');
  });

  test.each(['fr', 'de', 'es', 'it', 'pt', 'zh', 'ja', 'ar'] as const)('ships a %s translation in the bundle, not the English fallback', (language) => {
    // Act
    const i18n = createI18n(language);

    // Assert
    expect(i18n.t('action.undo')).not.toBe('Undo');
    expect(i18n.getFixedT('en')('action.undo')).toBe('Undo');
  });

  test('changes language in place', async () => {
    // Arrange
    const i18n = createI18n('en');

    // Act
    await i18n.changeLanguage('ar');

    // Assert
    expect(i18n.language).toBe('ar');
  });

  test('hands the instance to a plugin during init', () => {
    // Arrange
    const init = vi.fn();

    // Act
    const i18n = createI18n('en', [{ type: '3rdParty', init }]);

    // Assert
    expect(init).toHaveBeenCalledWith(i18n);
  });

  test('gives each caller its own instance', async () => {
    // Arrange
    const first = createI18n('en');
    const second = createI18n('en');

    // Act
    await first.changeLanguage('ar');

    // Assert
    expect(second.language).toBe('en');
  });

  test('plays plural forms by the CLDR rules of the language', async () => {
    // Arrange
    const i18n = createI18n('en');
    i18n.addResourceBundle('ar', 'common', { count_zero: 'z', count_one: 'o', count_two: 't', count_few: 'f', count_many: 'm', count_other: 'x' });
    await i18n.changeLanguage('ar');

    // Act
    const forms = [0, 1, 2, 3, 11, 100].map((count) => i18n.t('count' as never, { count }));

    // Assert
    expect(forms).toEqual(['z', 'o', 't', 'f', 'm', 'x']);
  });
});
