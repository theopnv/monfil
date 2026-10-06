// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, expect, test, vi } from 'vitest';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import { useIpcBridge } from '@/lib/ipc-bridge';
import Settings from './Settings';
import type { AppInfo, RefreshSummary } from '../../../shared/contracts';
import { HOME_WORKSPACE_ID } from '../../../shared/contracts';

const appInfo: AppInfo = { version: '1.2.3', feedCount: 2, itemCount: 42, databaseSizeBytes: 2048 };

let invokeImpl: (channel: string) => Promise<unknown>;
let feedsRefreshedHandlers: Set<(summary: RefreshSummary) => void>;

function IpcBridgeMount() {
  useIpcBridge();
  return null;
}

function renderSettings(withBridge = false) {
  return renderWithQueryClient(
    <ThemeProvider>
      <PreferencesProvider>
        {withBridge && <IpcBridgeMount />}
        <Settings />
      </PreferencesProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  feedsRefreshedHandlers = new Set();
  invokeImpl = (channel) => {
    switch (channel) {
      case 'app:get-info': return Promise.resolve(appInfo);
      case 'settings:get-refresh-interval': return Promise.resolve(30);
      case 'settings:get-refresh-on-launch': return Promise.resolve(true);
      case 'settings:set-refresh-interval': return Promise.resolve(60);
      case 'settings:set-refresh-on-launch': return Promise.resolve(false);
      case 'settings:get-retention-days': return Promise.resolve(30);
      case 'settings:set-retention-days': return Promise.resolve(90);
      case 'app:back-up-database': return Promise.resolve({ success: true, data: undefined });
      case 'opml:import': return Promise.resolve({ success: true, data: { workspaceId: 2, imported: 1, skipped: [], failed: [] } });
      default: return Promise.resolve(undefined);
    }
  };
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn((channel: string) => invokeImpl(channel)),
      on: vi.fn((channel: string, handler: (summary: RefreshSummary) => void) => {
        if (channel === 'feeds:refreshed') {
          feedsRefreshedHandlers.add(handler);
        }
        return vi.fn(() => feedsRefreshedHandlers.delete(handler));
      }),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

test('renders every section heading', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Assert
  await expect.element(getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Reading' })).toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Refreshing' })).toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Your data' })).toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'About' })).toBeInTheDocument();
});

test('choosing a theme persists it to localStorage', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Act
  await getByRole('button', { name: 'Dark' }).click();

  // Assert
  expect(localStorage.getItem('ui-theme')).toBe('dark');
});

test('choosing a density writes the preference', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Act
  await getByRole('button', { name: 'Compact' }).click();

  // Assert
  expect(JSON.parse(localStorage.getItem('preferences-density') ?? 'null')).toBe('Compact');
});

test('toggling "Hide read items in Home" writes the preference', async () => {
  // Arrange
  const { getByText } = await renderSettings();

  // Act
  // The switch input is visually hidden behind its label (react-aria's Switch pattern), so the
  // label text is what receives the click in the real DOM.
  await getByText('Hide read items in Home', { exact: true }).click();

  // Assert
  expect(JSON.parse(localStorage.getItem('preferences-hide-read-items') ?? 'null')).toBe(true);
});

test('toggling "Keyboard navigation" writes the preference', async () => {
  // Arrange
  const { getByText } = await renderSettings();

  // Act
  // The switch input is visually hidden behind its label (react-aria's Switch pattern), so the
  // label text is what receives the click in the real DOM.
  await getByText('Keyboard navigation', { exact: true }).click();

  // Assert
  expect(JSON.parse(localStorage.getItem('preferences-keyboard-navigation') ?? 'null')).toBe(false);
});

test('choosing a refresh interval invokes settings:set-refresh-interval', async () => {
  // Arrange
  const { getByRole } = await renderSettings();
  await expect.element(getByRole('button', { name: '1 h' })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: '1 h' }).click();

  // Assert
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('settings:set-refresh-interval', 60);
});

test('choosing retention saves the age limit', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Act
  await getByRole('button', { name: '90 days' }).click();

  // Assert
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('settings:set-retention-days', 90);
});

test('starts a database backup from Settings', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Act
  await getByRole('button', { name: 'Back up database…' }).click();

  // Assert
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('app:back-up-database', undefined);
});

test('toggling "Refresh on launch" invokes settings:set-refresh-on-launch', async () => {
  // Arrange
  const { getByRole, getByText } = await renderSettings();
  // The switch starts disabled until the current preference loads.
  await expect.element(getByRole('switch', { name: /^Refresh on launch/ })).toBeEnabled();

  // Act
  // The switch input is visually hidden behind its label (react-aria's Switch pattern), so the
  // label text is what receives the click in the real DOM.
  await getByText('Refresh on launch', { exact: true }).click();

  // Assert
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('settings:set-refresh-on-launch', false);
});

test('reveal database file sends app:reveal-database-file', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Act
  await getByRole('button', { name: 'Reveal database file' }).click();

  // Assert
  expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('app:reveal-database-file', undefined);
});

test('shares app info between the data stats and version', async () => {
  // Arrange
  const { getByRole, getByText } = await renderSettings();

  // Assert
  await expect.element(getByText('2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('42', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('2.0 KB', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('banner').getByText('Monfil 1.2.3', { exact: true })).toBeInTheDocument();
  expect(vi.mocked(window.electron.ipcRenderer.invoke).mock.calls.filter(([channel]) => channel === 'app:get-info')).toHaveLength(1);
  expect(window.electron.ipcRenderer.on).not.toHaveBeenCalled();
});

test.each<RefreshSummary>([
  { perFeed: [{ feedId: 1, inserted: 1 }] },
  { perFeed: [], removed: 1, applyImmediately: true },
  { perFeed: [] },
])('refreshes data stats through the bridge for %j', async (summary) => {
  // Arrange
  const { getByText } = await renderSettings(true);
  await expect.element(getByText('42', { exact: true })).toBeInTheDocument();
  const defaultInvoke = invokeImpl;
  invokeImpl = (channel) => channel === 'app:get-info'
    ? Promise.resolve({ ...appInfo, feedCount: 3, itemCount: 43, databaseSizeBytes: 4096 })
    : defaultInvoke(channel);

  // Act
  feedsRefreshedHandlers.forEach((handler) => handler(summary));

  // Assert
  await expect.element(getByText('3', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('43', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('4.0 KB', { exact: true })).toBeInTheDocument();
  expect(vi.mocked(window.electron.ipcRenderer.invoke).mock.calls.filter(([channel]) => channel === 'app:get-info')).toHaveLength(2);
  expect(feedsRefreshedHandlers.size).toBe(1);
});

test('importing OPML merged into Home invokes opml:import with that target', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Act
  await getByRole('button', { name: 'Import OPML' }).click();
  await getByRole('radio', { name: 'Merge into Home' }).click();
  await getByRole('button', { name: 'Import', exact: true }).click();

  // Assert
  await expect.element(getByRole('heading', { name: 'Import complete' })).toBeInTheDocument();
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('opml:import', { target: { kind: 'merge-workspace', workspaceId: HOME_WORKSPACE_ID } });
});
