import { useEffect, useState } from "react";
import { ipc, rendererLogger } from '@/lib/ipc-client';
import SegmentedControl from "@/components/common/SegmentedControl";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import type { RefreshInterval, RetentionDays } from "../../../shared/contracts";

const REFRESH_OPTIONS = [
  { interval: 15, label: "15 min" },
  { interval: 30, label: "30 min" },
  { interval: 60, label: "1 h" },
  { interval: 360, label: "6 h" },
  { interval: "manual", label: "Manual" },
] as const satisfies readonly { interval: RefreshInterval; label: string }[];

const REFRESH_INTERVALS = REFRESH_OPTIONS.map((option) => option.interval);
const REFRESH_LABELS = Object.fromEntries(REFRESH_OPTIONS.map((option) => [option.interval, option.label])) as Record<RefreshInterval, string>;

const RETENTION_OPTIONS = [15, 30, 60, 90, 180] as const satisfies readonly RetentionDays[];

export default function RefreshingSection() {
  const [refreshInterval, setRefreshIntervalState] = useState<RefreshInterval | undefined>(undefined);
  const [refreshOnLaunch, setRefreshOnLaunchState] = useState<boolean | undefined>(undefined);
  const [retentionDays, setRetentionDaysState] = useState<RetentionDays | undefined>(undefined);

  useEffect(() => {
    ipc.invoke("settings:get-refresh-interval", undefined)
      .then(setRefreshIntervalState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error loading the refresh interval:' }, error);
      });
    ipc.invoke("settings:get-refresh-on-launch", undefined)
      .then(setRefreshOnLaunchState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error loading the refresh-on-launch preference:' }, error);
      });
    ipc.invoke("settings:get-retention-days", undefined)
      .then(setRetentionDaysState)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Error loading retention:' }, error));
  }, []);

  const onIntervalChange = (interval: RefreshInterval) => {
    setRefreshIntervalState(interval);
    ipc.invoke("settings:set-refresh-interval", interval)
      .then(setRefreshIntervalState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error saving the refresh interval:' }, error);
      });
  };

  const onRefreshOnLaunchChange = (value: boolean) => {
    setRefreshOnLaunchState(value);
    ipc.invoke("settings:set-refresh-on-launch", value)
      .then(setRefreshOnLaunchState)
      .catch((error: unknown) => {
        rendererLogger.error('renderer.failure', { message: 'Error saving the refresh-on-launch preference:' }, error);
      });
  };

  const onRetentionChange = (value: RetentionDays) => {
    setRetentionDaysState(value);
    ipc.invoke("settings:set-retention-days", value)
      .then(setRetentionDaysState)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Error saving retention:' }, error));
  };

  return (
    <SettingsSection id="refreshing" title="Refreshing">
      <SettingsRow label="Refresh feeds" hint="How often Monfil checks your feeds for new items.">
        {refreshInterval !== undefined && (
          <SegmentedControl options={REFRESH_INTERVALS} value={refreshInterval} onChange={onIntervalChange} getLabel={(option) => REFRESH_LABELS[option]} />
        )}
      </SettingsRow>

      <Toggle
        className="w-full"
        label="Refresh on launch"
        hint="Also refresh once immediately when Monfil starts."
        isSelected={refreshOnLaunch ?? false}
        isDisabled={refreshOnLaunch === undefined}
        onChange={onRefreshOnLaunchChange}
      />

      <SettingsRow label="Keep articles for" hint="Remove older articles after this many days. Keep at least 10 per feed.">
        {retentionDays !== undefined && (
          <SegmentedControl options={RETENTION_OPTIONS} value={retentionDays} onChange={onRetentionChange} getLabel={(days) => `${days} days`} />
        )}
      </SettingsRow>
    </SettingsSection>
  );
}
