// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useServerSetting } from '@/lib/use-server-setting';
import SegmentedControl from "@/components/common/SegmentedControl";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import { REFRESH_INTERVALS, RETENTION_OPTIONS, type RefreshInterval } from "../../../shared/contracts";

const REFRESH_KEYS = { 15: "m15", 30: "m30", 60: "h1", 360: "h6", manual: "manual" } as const satisfies Record<RefreshInterval, string>;

export default function RefreshingSection() {
  const { t } = useTranslation('settings');
  const [refreshInterval, onIntervalChange] = useServerSetting('refreshInterval', { optimistic: true });
  const [refreshOnLaunch, onRefreshOnLaunchChange] = useServerSetting('refreshOnLaunch', { optimistic: true });
  const [retentionDays, onRetentionChange] = useServerSetting('retentionDays', { optimistic: true });

  return (
    <SettingsSection id="refreshing" title={t('section.refreshing')}>
      <SettingsRow label={t('refreshing.refresh')} hint={t('refreshing.refreshHint')}>
        {refreshInterval !== undefined && (
          <SegmentedControl options={REFRESH_INTERVALS} value={refreshInterval} onChange={onIntervalChange} getLabel={(option) => t(`refreshing.interval.${REFRESH_KEYS[option]}`)} />
        )}
      </SettingsRow>

      <Toggle
        className="w-full"
        label={t('refreshing.onLaunch')}
        hint={t('refreshing.onLaunchHint')}
        isSelected={refreshOnLaunch ?? false}
        isDisabled={refreshOnLaunch === undefined}
        onChange={onRefreshOnLaunchChange}
      />

      <SettingsRow label={t('refreshing.keep')} hint={t('refreshing.keepHint')}>
        {retentionDays !== undefined && (
          <SegmentedControl options={RETENTION_OPTIONS} value={retentionDays} onChange={onRetentionChange} getLabel={(days) => t('refreshing.days', { count: days })} />
        )}
      </SettingsRow>
    </SettingsSection>
  );
}
