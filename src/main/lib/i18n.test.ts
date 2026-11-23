// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, expect, test } from 'vitest';
import { fatalDialogText, mainFormatLocale, setMainLanguage, setMainSystemLocale } from './i18n';

afterEach(async () => {
  await setMainLanguage('en');
  setMainSystemLocale('');
});

test('builds the fatal dialog text with the incident id and three buttons', () => {
  // Act
  const text = fatalDialogText('ab12cd34');

  // Assert
  expect(text).toEqual({
    title: 'Monfil could not continue',
    message: 'Monfil encountered a system error. Incident ab12cd34.',
    buttons: ['Restart', 'Show log file', 'Quit'],
  });
});

test('keeps the system locale when it speaks the interface language', async () => {
  // Arrange
  setMainSystemLocale('fr_CA');

  // Act
  await setMainLanguage('fr');

  // Assert
  expect(mainFormatLocale()).toBe('fr-CA');
});

test('ignores a system locale of another language', async () => {
  // Arrange
  setMainSystemLocale('en-US');

  // Act
  await setMainLanguage('ja');

  // Assert
  expect(mainFormatLocale()).toBe('ja');
});
