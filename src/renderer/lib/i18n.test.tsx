// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { act } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { i18n, useFormatLocale } from './i18n';

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
