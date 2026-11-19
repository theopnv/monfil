// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createI18n } from '../shared/i18n/create-i18n';
import { DEFAULT_LANGUAGE, type LanguageCode } from '../shared/i18n/languages';

/** Translates the text that the main process shows: menus, dialogs, and error messages. */
export const mainI18n = createI18n(DEFAULT_LANGUAGE);

export async function setMainLanguage(language: LanguageCode): Promise<void> {
  await mainI18n.changeLanguage(language);
}
