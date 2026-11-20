// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { LanguageCode } from './languages';
import { languageOfTag } from './resolve-language';

export const SYSTEM_LOCALE_ARGUMENT = '--system-locale=';

/** The BCP 47 tag that stands for each language when no system locale narrows it down. */
export const BARE_LOCALE: Record<LanguageCode, string> = {
  en: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
  it: 'it',
  pt: 'pt-BR',
  zh: 'zh-Hans',
  ja: 'ja',
  ar: 'ar',
};

/**
 * The locale for dates, numbers, and relative times. The system locale wins when it speaks the
 * interface language, so fr-CA, ar-SA, and ar-MA keep their own conventions. Otherwise the bare
 * language is used, so a French interface never shows American dates.
 */
export function resolveFormatLocale(language: LanguageCode, systemLocale: string | undefined): string {
  if (systemLocale && languageOfTag(systemLocale) === language) {
    return systemLocale.replaceAll('_', '-');
  }
  return BARE_LOCALE[language];
}
