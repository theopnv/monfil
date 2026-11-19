// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { act } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { applyDocumentLanguage, i18n, INITIAL_LANGUAGE, initialLanguage, useFormatLocale } from './i18n';

afterEach(async () => {
  await i18n.changeLanguage('en');
  delete (window as { electron?: unknown }).electron;
});

describe('useFormatLocale', () => {
  test('gives the bare interface language when the window has no system locale', async () => {
    // Act
    const { result } = await renderHook(() => useFormatLocale());

    // Assert
    expect(result.current).toBe('en');
  });

  test('keeps the system locale when it speaks the interface language', async () => {
    // Arrange
    window.electron = { systemLocale: 'en-GB' } as typeof window.electron;

    // Act
    const { result } = await renderHook(() => useFormatLocale());

    // Assert
    expect(result.current).toBe('en-GB');
  });

  test('follows a language switch and drops a system locale of another language', async () => {
    // Arrange
    window.electron = { systemLocale: 'en-GB' } as typeof window.electron;
    const { result } = await renderHook(() => useFormatLocale());

    // Act
    await act(async () => {
      await i18n.changeLanguage('fr');
    });

    // Assert
    expect(result.current).toBe('fr');
  });
});

describe('initialLanguage', () => {
  test('is English when the window has no preload bridge', () => {
    // Act & Assert
    expect(initialLanguage({})).toBe('en');
    expect(INITIAL_LANGUAGE).toBe('en');
  });

  test.each(['fr', 'de', 'es', 'it', 'pt', 'zh', 'ja', 'ar', 'en'] as const)('is %s when main resolved it, so the first render needs no switch', (language) => {
    // Act & Assert
    expect(initialLanguage({ electron: { language } })).toBe(language);
  });

  test.each(['tlh', 'pt-BR', '', null, 3])('is English when the bridge carries %j, which Monfil does not list', (language) => {
    // Act & Assert
    expect(initialLanguage({ electron: { language } })).toBe('en');
  });

  test('starts the shared instance in the language of the bridge', () => {
    // Act & Assert
    expect(i18n.language).toBe(INITIAL_LANGUAGE);
  });
});

describe('applyDocumentLanguage', () => {
  afterEach(() => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  test.each([['ar', 'rtl'], ['fr', 'ltr'], ['ja', 'ltr']] as const)('tags the page %s as %s', (language, dir) => {
    // Arrange
    // Act
    applyDocumentLanguage(language);

    // Assert
    expect(document.documentElement.lang).toBe(language);
    expect(document.documentElement.dir).toBe(dir);
  });
});
