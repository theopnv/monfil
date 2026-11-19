// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { useLocale } from 'react-aria-components';
import { i18n, setRendererLanguage } from '@/lib/i18n';
import { LanguageProvider } from './language-provider';

afterEach(async () => {
  await setRendererLanguage('en');
});

function ReactAriaLocale() {
  const { locale, direction } = useLocale();
  return <p data-testid="locale">{locale} {direction}</p>;
}

describe('LanguageProvider', () => {
  test('tags the document as English and left to right at start', async () => {
    // Act
    await render(<LanguageProvider><ReactAriaLocale /></LanguageProvider>);

    // Assert
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('flips the document and react-aria to right to left when the language changes to Arabic', async () => {
    // Arrange
    const { getByTestId } = await render(<LanguageProvider><ReactAriaLocale /></LanguageProvider>);

    // Act
    await setRendererLanguage('ar');

    // Assert
    await expect.element(getByTestId('locale')).toHaveTextContent('ar rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  test('follows a language change that comes through i18next alone', async () => {
    // Arrange
    const { getByTestId } = await render(<LanguageProvider><ReactAriaLocale /></LanguageProvider>);

    // Act
    await i18n.changeLanguage('ja');

    // Assert
    await expect.element(getByTestId('locale')).toHaveTextContent('ja ltr');
    expect(document.documentElement.lang).toBe('ja');
  });

  test('falls back to English for a tag that Monfil does not list', async () => {
    // Arrange
    const { getByTestId } = await render(<LanguageProvider><ReactAriaLocale /></LanguageProvider>);

    // Act
    await i18n.changeLanguage('ko');

    // Assert
    await expect.element(getByTestId('locale')).toHaveTextContent('en ltr');
    expect(document.documentElement.lang).toBe('en');
  });
});
