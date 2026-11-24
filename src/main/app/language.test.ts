// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { app } from 'electron';
import { mainI18n, setMainLanguage } from '../lib/i18n';
import { logger } from '../logging/logger';
import { changeLanguage, initializeLanguage, readLanguageState } from './language';
import * as settings from './settings';
import { useTestDatabase } from '../test/db';

vi.mock(import('electron'), () => ({ app: { getPreferredSystemLanguages: vi.fn(() => ['en-US']) } as unknown as typeof app }));
vi.mock(import('../logging/logger'), () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() }, setDetailedLogging: vi.fn() }));
vi.mock(import('./settings'), { spy: true });

function systemLanguages(...tags: string[]) {
  vi.mocked(app.getPreferredSystemLanguages).mockReturnValue(tags);
}

useTestDatabase();

beforeEach(() => {
  systemLanguages('en-US');
});

afterEach(async () => {
  await setMainLanguage('en');
});

describe('initializeLanguage', () => {
  test('follows the first supported language of the system when nothing is stored', async () => {
    // Arrange
    systemLanguages('sv-SE', 'fr-CA', 'en-US');

    // Act
    const state = await initializeLanguage();

    // Assert
    expect(state).toEqual({ setting: 'system', language: 'fr', systemLanguage: 'fr' });
    expect(mainI18n.language).toBe('fr');
  });

  test('uses English when the system asks for a language that Monfil lacks, such as Traditional Chinese', async () => {
    // Arrange
    systemLanguages('zh-Hant-TW');

    // Act
    const state = await initializeLanguage();

    // Assert
    expect(state.language).toBe('en');
    expect(mainI18n.language).toBe('en');
  });

  test('keeps a stored choice over the language of the system', async () => {
    // Arrange
    systemLanguages('fr-FR');
    await settings.setLanguageSetting('ja');

    // Act
    const state = await initializeLanguage();

    // Assert
    expect(state).toEqual({ setting: 'ja', language: 'ja', systemLanguage: 'fr' });
    expect(mainI18n.language).toBe('ja');
  });

  test('falls back to the system language and logs when the stored choice cannot be read', async () => {
    // Arrange
    systemLanguages('de-DE');
    vi.mocked(settings.getLanguageSetting).mockRejectedValueOnce(new Error('database is gone'));

    // Act
    const state = await initializeLanguage();

    // Assert
    expect(state).toEqual({ setting: 'system', language: 'de', systemLanguage: 'de' });
    expect(logger.warn).toHaveBeenCalledWith('operation.failure', { operation: 'language.read' }, expect.any(Error));
  });
});

describe('readLanguageState', () => {
  test('shows the stored choice next to what the system would give', async () => {
    // Arrange
    systemLanguages('it-IT');
    await settings.setLanguageSetting('ar');

    // Act
    const state = await readLanguageState();

    // Assert
    expect(state).toEqual({ setting: 'ar', language: 'ar', systemLanguage: 'it' });
  });
});

describe('changeLanguage', () => {
  test('stores the choice and moves the main process to its language', async () => {
    // Act
    const state = await changeLanguage('ar');

    // Assert
    expect(state).toEqual({ setting: 'ar', language: 'ar', systemLanguage: 'en' });
    expect(await settings.getLanguageSetting()).toBe('ar');
    expect(mainI18n.language).toBe('ar');
  });

  test('goes back to the language of the system when the choice is system', async () => {
    // Arrange
    systemLanguages('es-MX');
    await changeLanguage('ja');

    // Act
    const state = await changeLanguage('system');

    // Assert
    expect(state).toEqual({ setting: 'system', language: 'es', systemLanguage: 'es' });
    expect(mainI18n.language).toBe('es');
  });
});
