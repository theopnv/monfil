// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { i18n, setRendererLanguage } from '@/lib/i18n';
import LanguageRow from './LanguageRow';
import type { LanguageState } from '../../../shared/contracts';
import type { LanguageSetting } from '../../../shared/i18n/languages';

let state: LanguageState;
const invoke = vi.fn();

function stateFor(setting: LanguageSetting, systemLanguage: LanguageState['systemLanguage'] = 'en'): LanguageState {
  return { setting, language: setting === 'system' ? systemLanguage : setting, systemLanguage };
}

beforeEach(() => {
  state = stateFor('system', 'fr');
  invoke.mockReset();
  invoke.mockImplementation((channel: string, arg: { key: string; value?: LanguageSetting }) => {
    if (channel === 'settings:set' && arg.value) {
      state = stateFor(arg.value, 'fr');
    }
    return Promise.resolve(state);
  });
  window.electron = { ipcRenderer: { invoke, on: vi.fn(), sendMessage: vi.fn() } } as unknown as typeof window.electron;
});

afterEach(async () => {
  await setRendererLanguage('en');
});

function renderRow() {
  return render(<LanguageRow />);
}

describe('LanguageRow', () => {
  test('offers System first, with the language that the system resolves to, then every language by its own name', async () => {
    // Act
    const { getByRole } = await renderRow();

    // Assert
    const select = getByRole('combobox', { name: 'Language' });
    await expect.element(select).toHaveValue('system');
    const labels = Array.from(select.element().querySelectorAll('option'), (option) => option.textContent);
    expect(labels).toEqual([
      'System (Français)', 'English', 'Français (beta)', 'Deutsch (beta)', 'Español (beta)', 'Italiano (beta)',
      'Português (Brasil) (beta)', '简体中文 (beta)', '日本語 (beta)', 'العربية (beta)',
    ]);
  });

  test('tags each option with its language, so the browser picks a font for its script', async () => {
    // Act
    const { getByRole } = await renderRow();

    // Assert
    const options = Array.from(getByRole('combobox', { name: 'Language' }).element().querySelectorAll('option'));
    expect(options.map((option) => option.lang)).toEqual(['fr', 'en', 'fr', 'de', 'es', 'it', 'pt', 'zh', 'ja', 'ar']);
  });

  test('stays disabled until the stored choice has loaded', async () => {
    // Arrange
    invoke.mockReturnValue(new Promise(() => undefined));

    // Act
    const { getByRole } = await renderRow();

    // Assert
    await expect.element(getByRole('combobox', { name: 'Language' })).toBeDisabled();
  });

  test('stores the choice, then switches the interface language and the page direction at once', async () => {
    // Arrange
    const { getByRole, getByText } = await renderRow();

    // Act
    await getByRole('combobox', { name: 'Language' }).selectOptions('ar');

    // Assert
    expect(invoke).toHaveBeenCalledWith('settings:set', { key: 'language', value: 'ar' });
    await expect.element(getByText('اللغة', { exact: true })).toBeInTheDocument();
    expect(i18n.language).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  test('goes back to the language of the system', async () => {
    // Arrange
    state = stateFor('ja', 'fr');
    const { getByRole } = await renderRow();
    await setRendererLanguage('ja');

    // Act
    await getByRole('combobox').selectOptions('system');

    // Assert
    expect(invoke).toHaveBeenCalledWith('settings:set', { key: 'language', value: 'system' });
    await vi.waitFor(() => expect(i18n.language).toBe('fr'));
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('warns that a machine drafted the translation while a language without review is in use', async () => {
    // Arrange
    state = stateFor('de', 'en');
    await setRendererLanguage('de');

    // Act
    const { getByText } = await renderRow();

    // Assert
    await expect.element(getByText(i18n.t('settings:appearance.languageBetaHint'), { exact: true })).toBeInTheDocument();
  });

  test('shows the plain hint for English, which a person wrote', async () => {
    // Arrange
    state = stateFor('en', 'en');

    // Act
    const { getByText } = await renderRow();

    // Assert
    await expect.element(getByText('The language of menus, dialogs, and messages. Feed text stays as it is.', { exact: true })).toBeInTheDocument();
  });

  test('keeps the old language when the main process cannot store the choice', async () => {
    // Arrange
    const { getByRole } = await renderRow();
    invoke.mockImplementation((channel: string) => (channel === 'settings:set' ? Promise.reject(new Error('disk full')) : Promise.resolve(state)));

    // Act
    await getByRole('combobox', { name: 'Language' }).selectOptions('ja');

    // Assert
    expect(i18n.language).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
