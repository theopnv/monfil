// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { app } from 'electron';
import type { LanguageState } from '../../shared/contracts';
import { resolveLanguage, resolveSystemLanguage } from '../../shared/i18n/resolve-language';
import type { LanguageSetting } from '../../shared/i18n/languages';
import { setMainLanguage } from '../lib/i18n';
import { logger } from '../logging/logger';
import { DEFAULT_LANGUAGE_SETTING, getLanguageSetting, setLanguageSetting } from './settings';

function stateOf(setting: LanguageSetting): LanguageState {
  // `app.getLocale()` reports en-US on macOS when the bundle lists no localizations, so the ordered preference list is the reliable source.
  const systemLanguages = app.getPreferredSystemLanguages();
  return { setting, language: resolveLanguage(setting, systemLanguages), systemLanguage: resolveSystemLanguage(systemLanguages) };
}

/** Reads the stored choice and points the main process at the language it gives. Call it once the app is ready, before the first window. */
export async function initializeLanguage(): Promise<LanguageState> {
  const setting = await getLanguageSetting().catch((error: unknown) => {
    logger.warn('operation.failure', { operation: 'language.read' }, error);
    return DEFAULT_LANGUAGE_SETTING;
  });
  const state = stateOf(setting);
  await setMainLanguage(state.language);
  return state;
}

/** The state that the settings screen shows: the stored choice and what it resolves to. */
export async function readLanguageState(): Promise<LanguageState> {
  return stateOf(await getLanguageSetting());
}

/**
 * Stores a new choice and moves the main process to its language, so the next menu or dialog uses it.
 * @param setting the choice to store
 */
export async function changeLanguage(setting: LanguageSetting): Promise<LanguageState> {
  await setLanguageSetting(setting);
  const state = stateOf(setting);
  await setMainLanguage(state.language);
  return state;
}
