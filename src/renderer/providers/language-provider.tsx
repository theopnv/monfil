// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, type ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components';
import { applyDocumentLanguage, useActiveLanguage } from '@/lib/i18n';

/** Keeps `<html lang dir>` and react-aria's date, number, and collation rules on the language that i18next has. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useActiveLanguage();

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  return <I18nProvider locale={language}>{children}</I18nProvider>;
}
