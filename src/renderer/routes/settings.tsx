import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type ChangeEvent } from 'react';

import { ThemeToggle } from '@/components/ThemeToggle';
import type { RefreshInterval } from '../../preload/channels';

export const Route = createFileRoute('/settings')({
  component: SettingsComponent,
})

const REFRESH_OPTIONS = [
  { value: '15', label: 'Every 15 minutes', interval: 15 },
  { value: '30', label: 'Every 30 minutes', interval: 30 },
  { value: '60', label: 'Every hour', interval: 60 },
  { value: '360', label: 'Every 6 hours', interval: 360 },
  { value: 'manual', label: 'Manual only', interval: 'manual' },
] as const satisfies readonly { value: string; label: string; interval: RefreshInterval }[];

function SettingsComponent() {
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval | undefined>(undefined);

  useEffect(() => {
    window.electron.ipcRenderer.invoke('settings:get-refresh-interval', undefined)
      .then(setRefreshInterval)
      .catch((error: unknown) => {
        console.error('Error loading the refresh interval:', error);
      });
  }, []);

  const onRefreshIntervalChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = REFRESH_OPTIONS.find((candidate) => candidate.value === event.target.value);
    if (!option) return;

    setRefreshInterval(option.interval);
    window.electron.ipcRenderer.invoke('settings:set-refresh-interval', option.interval)
      .then(setRefreshInterval)
      .catch((error: unknown) => {
        console.error('Error saving the refresh interval:', error);
      });
  };

  return <div className="flex flex-col gap-6 p-8">
    <h1 className="font-display text-display-sm text-primary">Settings</h1>
    <ThemeToggle />

    <div className="flex flex-col gap-1.5">
      <label htmlFor="refresh-interval" className="text-sm font-medium text-secondary">Refresh feeds</label>
      <select
        id="refresh-interval"
        className="w-60 rounded-lg border border-primary bg-primary px-3 py-2 text-md text-primary"
        value={refreshInterval === undefined ? '' : String(refreshInterval)}
        disabled={refreshInterval === undefined}
        onChange={onRefreshIntervalChange}
      >
        {REFRESH_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  </div>
}
