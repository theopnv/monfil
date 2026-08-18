import { useEffect, useState } from "react";
import SegmentedControl from "@/components/common/SegmentedControl";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import type { RefreshInterval } from "../../../preload/channels";

const REFRESH_OPTIONS = [
  { interval: 15, label: "15 min" },
  { interval: 30, label: "30 min" },
  { interval: 60, label: "1 h" },
  { interval: 360, label: "6 h" },
  { interval: "manual", label: "Manual" },
] as const satisfies readonly { interval: RefreshInterval; label: string }[];

const REFRESH_INTERVALS = REFRESH_OPTIONS.map((option) => option.interval);
const REFRESH_LABELS = Object.fromEntries(REFRESH_OPTIONS.map((option) => [option.interval, option.label])) as Record<RefreshInterval, string>;

export default function RefreshingSection() {
  const [refreshInterval, setRefreshIntervalState] = useState<RefreshInterval | undefined>(undefined);
  const [refreshOnLaunch, setRefreshOnLaunchState] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    window.electron.ipcRenderer.invoke("settings:get-refresh-interval", undefined)
      .then(setRefreshIntervalState)
      .catch((error: unknown) => {
        console.error("Error loading the refresh interval:", error);
      });
    window.electron.ipcRenderer.invoke("settings:get-refresh-on-launch", undefined)
      .then(setRefreshOnLaunchState)
      .catch((error: unknown) => {
        console.error("Error loading the refresh-on-launch preference:", error);
      });
  }, []);

  const onIntervalChange = (interval: RefreshInterval) => {
    setRefreshIntervalState(interval);
    window.electron.ipcRenderer.invoke("settings:set-refresh-interval", interval)
      .then(setRefreshIntervalState)
      .catch((error: unknown) => {
        console.error("Error saving the refresh interval:", error);
      });
  };

  const onRefreshOnLaunchChange = (value: boolean) => {
    setRefreshOnLaunchState(value);
    window.electron.ipcRenderer.invoke("settings:set-refresh-on-launch", value)
      .then(setRefreshOnLaunchState)
      .catch((error: unknown) => {
        console.error("Error saving the refresh-on-launch preference:", error);
      });
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
    </SettingsSection>
  );
}
