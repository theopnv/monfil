// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createI18n } from '../../shared/i18n/create-i18n';
import type { FatalDialogText } from '../logging/fatal';
import { DEFAULT_LANGUAGE, type LanguageCode } from '../../shared/i18n/languages';

/** Translates the text that the main process shows: menus, dialogs, and error messages. */
export const mainI18n = createI18n(DEFAULT_LANGUAGE);

export async function setMainLanguage(language: LanguageCode): Promise<void> {
  await mainI18n.changeLanguage(language);
}

/** The text of the dialog that the fatal handler shows. The handler lives in the logging folder, which may not import this one, so main.ts passes this function in. */
export function fatalDialogText(incident: string): FatalDialogText {
  return {
    title: mainI18n.t('main:fatal.title'),
    message: mainI18n.t('main:fatal.message', { incident }),
    buttons: [mainI18n.t('main:fatal.restart'), mainI18n.t('main:fatal.showLog'), mainI18n.t('main:fatal.quit')],
  };
}
