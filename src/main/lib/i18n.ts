// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createI18n } from '../../shared/i18n/create-i18n';
import type { FatalDialogText } from '../logging/fatal';
import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from '../../shared/i18n/languages';
import { resolveFormatLocale } from '../../shared/i18n/format-locale';

/** Translates the text that the main process shows: menus, dialogs, and error messages. */
export const mainI18n = createI18n(DEFAULT_LANGUAGE);

export async function setMainLanguage(language: LanguageCode): Promise<void> {
  await mainI18n.changeLanguage(language);
}

let systemLocale: string | undefined;

/** Records the operating system locale. Electron gives it only once the app is ready, so main.ts calls this then. */
export function setMainSystemLocale(locale: string): void {
  systemLocale = locale;
}

/** The locale for the dates and numbers that main writes into stored text, such as a salary label. */
export function mainFormatLocale(): string {
  const language = isLanguageCode(mainI18n.language) ? mainI18n.language : DEFAULT_LANGUAGE;
  return resolveFormatLocale(language, systemLocale);
}

/** The text of the dialog that the fatal handler shows. The handler lives in the logging folder, which may not import this one, so main.ts passes this function in. */
export function fatalDialogText(incident: string): FatalDialogText {
  return {
    title: mainI18n.t('main:fatal.title'),
    message: mainI18n.t('main:fatal.message', { incident }),
    buttons: [mainI18n.t('main:fatal.restart'), mainI18n.t('main:fatal.showLog'), mainI18n.t('main:fatal.quit')],
  };
}
