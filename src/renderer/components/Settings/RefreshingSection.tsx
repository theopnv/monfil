import { useEffect, useState } from "react";
import SegmentedControl from "@/components/common/SegmentedControl";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import type { MaxFeedItems, RefreshInterval } from "../../../preload/channels";

const REFRESH_OPTIONS = [
  { interval: 15, label: "15 min" },
  { interval: 30, label: "30 min" },
  { interval: 60, label: "1 h" },
  { interval: 360, label: "6 h" },
  { interval: "manual", label: "Manual" },
] as const satisfies readonly { interval: RefreshInterval; label: string }[];

const REFRESH_INTERVALS = REFRESH_OPTIONS.map((option) => option.interval);
const REFRESH_LABELS = Object.fromEntries(REFRESH_OPTIONS.map((option) => [option.interval, option.label])) as Record<RefreshInterval, string>;

const MAX_ITEMS_OPTIONS = [10, 30, 50, 100] as const satisfies readonly MaxFeedItems[];

export default function RefreshingSection() {
  const [refreshInterval, setRefreshIntervalState] = useState<RefreshInterval | undefined>(undefined);
  const [refreshOnLaunch, setRefreshOnLaunchState] = useState<boolean | undefined>(undefined);
  const [maxFeedItems, setMaxFeedItemsState] = useState<MaxFeedItems | undefined>(undefined);

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
    window.electron.ipcRenderer.invoke("settings:get-max-feed-items", undefined)
      .then(setMaxFeedItemsState)
      .catch((error: unknown) => {
        console.error("Error loading the max feed items preference:", error);
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

  const onMaxFeedItemsChange = (value: MaxFeedItems) => {
    setMaxFeedItemsState(value);
    window.electron.ipcRenderer.invoke("settings:set-max-feed-items", value)
      .then(setMaxFeedItemsState)
      .catch((error: unknown) => {
        console.error("Error saving the max feed items preference:", error);
      });
  };

  return (
    <SettingsSection id="refreshing" title="Refreshing">
      <SettingsRow label="Refresh feeds" hint="How often Monfil checks your feeds for new items.">
        {refreshInterval !== undefined && (
          <SegmentedControl options={REFRESH_INTERVALS} value={refreshInterval} onChange={onIntervalChange} getLabel={(option) => REFRESH_LABELS[option]} />
        )}
      </SettingsRow>

      <SettingsRow label="Items per feed" hint="How many recent items to keep each time a feed is fetched.">
        {maxFeedItems !== undefined && (
          <SegmentedControl options={MAX_ITEMS_OPTIONS} value={maxFeedItems} onChange={onMaxFeedItemsChange} />
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
