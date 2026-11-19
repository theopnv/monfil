// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import SegmentedControl from "@/components/common/SegmentedControl";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { DENSITIES } from "@/lib/preferences";
import { usePreferences } from "@/providers/preferences-provider";
import { useTheme } from "@/providers/theme-provider";

const THEMES = ["light", "dark", "system"] as const;

// The stored density values double as the labels today, so the keys are kept apart from them.
const DENSITY_KEYS = { Cards: "cards", Magazine: "magazine", Compact: "compact" } as const;

export default function AppearanceSection() {
  const { t } = useTranslation('settings');
  const { theme, setTheme } = useTheme();
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsSection id="appearance" title={t('section.appearance')}>
      <SettingsRow label={t('appearance.theme')} hint={t(`appearance.themeHints.${theme}`)}>
        <SegmentedControl options={THEMES} value={theme} onChange={setTheme} getLabel={(option) => t(`appearance.themes.${option}`)} />
      </SettingsRow>

      <SettingsRow label={t('appearance.density')} hint={t('appearance.densityHint')}>
        <SegmentedControl options={DENSITIES} value={preferences.density} onChange={(density) => setPreference("density", density)} getLabel={(density) => t(`appearance.densities.${DENSITY_KEYS[density]}`)} />
      </SettingsRow>
    </SettingsSection>
  );
}
