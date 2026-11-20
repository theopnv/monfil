// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { ipc, rendererLogger } from '@/lib/ipc-client';
import SegmentedControl from "@/components/common/SegmentedControl";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import type { RefreshInterval, RetentionDays } from "../../../shared/contracts";

const REFRESH_OPTIONS = [
  { interval: 15, key: "m15" },
  { interval: 30, key: "m30" },
  { interval: 60, key: "h1" },
  { interval: 360, key: "h6" },
  { interval: "manual", key: "manual" },
] as const satisfies readonly { interval: RefreshInterval; key: string }[];

const REFRESH_INTERVALS = REFRESH_OPTIONS.map((option) => option.interval);
const REFRESH_KEYS = Object.fromEntries(REFRESH_OPTIONS.map((option) => [option.interval, option.key])) as Record<RefreshInterval, (typeof REFRESH_OPTIONS)[number]["key"]>;

const RETENTION_OPTIONS = [15, 30, 60, 90, 180] as const satisfies readonly RetentionDays[];

export default function RefreshingSection() {
  const { t } = useTranslation('settings');
  const [refreshInterval, setRefreshIntervalState] = useState<RefreshInterval | undefined>(undefined);
  const [refreshOnLaunch, setRefreshOnLaunchState] = useState<boolean | undefined>(undefined);
  const [retentionDays, setRetentionDaysState] = useState<RetentionDays | undefined>(undefined);

  useEffect(() => {
    ipc.invoke('settings:get', { key: 'refreshInterval' })
      .then(setRefreshIntervalState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error loading the refresh interval:' }, error);
      });
    ipc.invoke('settings:get', { key: 'refreshOnLaunch' })
      .then(setRefreshOnLaunchState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error loading the refresh-on-launch preference:' }, error);
      });
    ipc.invoke('settings:get', { key: 'retentionDays' })
      .then(setRetentionDaysState)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Error loading retention:' }, error));
  }, []);

  const onIntervalChange = (interval: RefreshInterval) => {
    setRefreshIntervalState(interval);
    ipc.invoke('settings:set', { key: 'refreshInterval', value: interval })
      .then(setRefreshIntervalState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error saving the refresh interval:' }, error);
      });
  };

  const onRefreshOnLaunchChange = (value: boolean) => {
    setRefreshOnLaunchState(value);
    ipc.invoke('settings:set', { key: 'refreshOnLaunch', value: value })
      .then(setRefreshOnLaunchState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error saving the refresh-on-launch preference:' }, error);
      });
  };

  const onRetentionChange = (value: RetentionDays) => {
    setRetentionDaysState(value);
    ipc.invoke('settings:set', { key: 'retentionDays', value: value })
      .then(setRetentionDaysState)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Error saving retention:' }, error));
  };

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
