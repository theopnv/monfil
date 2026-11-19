// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode, type LanguageSetting } from './languages';

/** Maps one BCP 47 tag to a supported language, or null. Only Simplified Chinese is supported, so zh-TW and zh-Hant give null. */
function languageOfTag(tag: string): LanguageCode | null {
  let locale: Intl.Locale;
  try {
    locale = new Intl.Locale(tag.replaceAll('_', '-'));
  } catch {
    return null;
  }
  if (locale.language === 'zh') {
    return locale.maximize().script === 'Hans' ? 'zh' : null;
  }
  return isLanguageCode(locale.language) ? locale.language : null;
}

/** Picks the first system language, in the user's order, that Monfil supports. Falls back to English. */
export function resolveSystemLanguage(systemLanguages: readonly string[]): LanguageCode {
  for (const tag of systemLanguages) {
    const language = languageOfTag(tag);
    if (language !== null) {
      return language;
    }
  }
  return DEFAULT_LANGUAGE;
}

export function resolveLanguage(setting: LanguageSetting, systemLanguages: readonly string[]): LanguageCode {
  return setting === 'system' ? resolveSystemLanguage(systemLanguages) : setting;
}
