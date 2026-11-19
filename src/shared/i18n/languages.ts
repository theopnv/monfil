// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** The interface languages. `reviewed` turns true once a native speaker has checked the machine draft. */
export const LANGUAGES = [
  { code: 'en', nativeName: 'English', dir: 'ltr', reviewed: true },
  { code: 'fr', nativeName: 'Français', dir: 'ltr', reviewed: false },
  { code: 'de', nativeName: 'Deutsch', dir: 'ltr', reviewed: false },
  { code: 'es', nativeName: 'Español', dir: 'ltr', reviewed: false },
  { code: 'it', nativeName: 'Italiano', dir: 'ltr', reviewed: false },
  { code: 'pt', nativeName: 'Português (Brasil)', dir: 'ltr', reviewed: false },
  { code: 'zh', nativeName: '简体中文', dir: 'ltr', reviewed: false },
  { code: 'ja', nativeName: '日本語', dir: 'ltr', reviewed: false },
  { code: 'ar', nativeName: 'العربية', dir: 'rtl', reviewed: false },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** The stored language choice: follow the operating system, or force one language. */
export type LanguageSetting = 'system' | LanguageCode;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** The command-line argument that carries the interface language from main to the preload script. */
export const LANGUAGE_ARGUMENT = '--language=';

export const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map((language) => language.code);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGE_CODES.some((code) => code === value);
}

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return value === 'system' || isLanguageCode(value);
}

/** The text direction of a language. Prefer this over `i18n.dir()`, which follows the fallback language while a translation is missing. */
export function directionOf(code: LanguageCode): 'ltr' | 'rtl' {
  return LANGUAGES.find((language) => language.code === code)?.dir ?? 'ltr';
}
