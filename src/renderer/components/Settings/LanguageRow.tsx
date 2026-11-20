// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import NativeSelect from '@/components/common/NativeSelect';
import SettingsRow from '@/components/Settings/SettingsRow';
import { setRendererLanguage } from '@/lib/i18n';
import { useServerSetting } from '@/lib/use-server-setting';
import { isLanguageSetting, LANGUAGES, type LanguageCode } from '../../../shared/i18n/languages';

function nativeNameOf(code: LanguageCode): string {
  return LANGUAGES.find((language) => language.code === code)?.nativeName ?? code;
}

export default function LanguageRow() {
  const { t } = useTranslation('settings');
  const [state, save] = useServerSetting('language', { onSaved: (next) => setRendererLanguage(next.language) });

  const onChange = (value: string) => {
    if (isLanguageSetting(value)) {
      save(value);
    }
  };

  const showsBeta = state !== undefined && !(LANGUAGES.find((language) => language.code === state.language)?.reviewed ?? true);

  return (
    <SettingsRow label={t('appearance.language')} hint={showsBeta ? t('appearance.languageBetaHint') : t('appearance.languageHint')}>
      <NativeSelect aria-label={t('appearance.language')} value={state?.setting ?? ''} disabled={state === undefined} onChange={(event) => onChange(event.target.value)}>
        {state === undefined && <option value="" />}
        <option value="system" lang={state?.systemLanguage}>{t('appearance.languageSystem', { language: nativeNameOf(state?.systemLanguage ?? 'en') })}</option>
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code} lang={language.code}>
            {language.reviewed ? language.nativeName : t('appearance.languageBeta', { language: language.nativeName })}
          </option>
        ))}
      </NativeSelect>
    </SettingsRow>
  );
}
