// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { initReactI18next, useTranslation } from 'react-i18next';
import { createI18n } from '../../shared/i18n/create-i18n';
import { DEFAULT_LANGUAGE, directionOf, isLanguageCode, type LanguageCode } from '../../shared/i18n/languages';

// The instance starts in English and is global, so a component that no provider wraps still translates. The test suites rely on that default.
export const i18n = createI18n(DEFAULT_LANGUAGE, [initReactI18next]);

/** The language that is active now. It falls back to English if i18next holds a tag that Monfil does not list. */
export function useActiveLanguage(): LanguageCode {
  const { i18n: active } = useTranslation();
  return isLanguageCode(active.language) ? active.language : DEFAULT_LANGUAGE;
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
