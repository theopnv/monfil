// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import SettingsSection from "@/components/Settings/SettingsSection";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import { usePreferences } from "@/providers/preferences-provider";

export default function ReadingSection() {
  const { t } = useTranslation('settings');
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsSection id="reading" title={t('section.reading')}>
      <Toggle
        className="w-full"
        label={t('reading.markScroll')}
        hint={t('reading.markScrollHint')}
        isSelected={preferences.markReadOnScroll}
        onChange={(isSelected) => setPreference("markReadOnScroll", isSelected)}
      />
      <Toggle
        className="w-full"
        label={t('reading.hideRead')}
        hint={t('reading.hideReadHint')}
        isSelected={preferences.hideReadItems}
        onChange={(isSelected) => setPreference("hideReadItems", isSelected)}
      />
      <Toggle
        className="w-full"
        label={t('reading.keyboard')}
        hint={t('reading.keyboardHint')}
        isSelected={preferences.keyboardNavigation}
        onChange={(isSelected) => setPreference("keyboardNavigation", isSelected)}
      />
      <Toggle
        className="w-full"
        label={t('reading.external')}
        hint={t('reading.externalHint')}
        isSelected={preferences.openLinksExternally}
        onChange={(isSelected) => setPreference("openLinksExternally", isSelected)}
      />
    </SettingsSection>
  );
}
