// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { initReactI18next, useTranslation } from 'react-i18next';
import { createI18n } from '../../shared/i18n/create-i18n';
import { resolveFormatLocale } from '../../shared/i18n/format-locale';
import { DEFAULT_LANGUAGE, directionOf, isLanguageCode, type LanguageCode } from '../../shared/i18n/languages';

/** The language that main resolved when it made the window. English when there is no preload bridge, as in the test suites. */
export function initialLanguage(bridge: { electron?: { language?: unknown } }): LanguageCode {
  const language = bridge.electron?.language;
  return isLanguageCode(language) ? language : DEFAULT_LANGUAGE;
}

export const INITIAL_LANGUAGE: LanguageCode = initialLanguage(window);

// The instance is global, so a component that no provider wraps still translates.
export const i18n = createI18n(INITIAL_LANGUAGE, [initReactI18next]);

/** The language that is active now. It falls back to English if i18next holds a tag that Monfil does not list. */
export function useActiveLanguage(): LanguageCode {
  const { i18n: active } = useTranslation();
  return isLanguageCode(active.language) ? active.language : DEFAULT_LANGUAGE;
}

/** The locale for dates, numbers, and relative times: the system locale when it speaks the interface language, else the bare language. */
export function useFormatLocale(): string {
  const language = useActiveLanguage();
  // Tests and the first paint can run without the preload bridge.
  const systemLocale = window.electron?.systemLocale;
  return resolveFormatLocale(language, systemLocale);
}

/** Points the document at a language, so CSS `:lang()` rules and the layout direction follow it. */
export function applyDocumentLanguage(language: LanguageCode): void {
  document.documentElement.lang = language;
  document.documentElement.dir = directionOf(language);
}

export async function setRendererLanguage(language: LanguageCode): Promise<void> {
  await i18n.changeLanguage(language);
  applyDocumentLanguage(language);
}
