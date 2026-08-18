import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import Settings from './Settings';
import type { AppInfo } from '../../../main/app-info';

const appInfo: AppInfo = { version: '1.2.3', feedCount: 2, itemCount: 10, databaseSizeBytes: 2048 };

let invokeImpl: (channel: string) => Promise<unknown>;

function renderSettings() {
  return render(
    <ThemeProvider>
      <PreferencesProvider>
        <Settings />
      </PreferencesProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  invokeImpl = (channel) => {
    switch (channel) {
      case 'app:get-info': return Promise.resolve(appInfo);
      case 'settings:get-refresh-interval': return Promise.resolve(30);
      case 'settings:get-refresh-on-launch': return Promise.resolve(true);
      case 'settings:set-refresh-interval': return Promise.resolve(60);
      case 'settings:set-refresh-on-launch': return Promise.resolve(false);
      default: return Promise.resolve(undefined);
    }
  };
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn((channel: string) => invokeImpl(channel)),
      on: vi.fn(() => vi.fn()),
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

test('choosing a refresh interval invokes settings:set-refresh-interval', async () => {
  // Arrange
  const { getByRole } = await renderSettings();
  await expect.element(getByRole('button', { name: '1 h' })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: '1 h' }).click();

  // Assert
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('settings:set-refresh-interval', 60);
});

test('toggling "Refresh on launch" invokes settings:set-refresh-on-launch', async () => {
  // Arrange
  const { getByRole, getByText } = await renderSettings();
  // The switch starts disabled until the current preference loads.
  await expect.element(getByRole('switch', { name: 'Refresh on launch' })).toBeEnabled();

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

test('shows the your-data stats from app:get-info', async () => {
  // Arrange
  const { getByText } = await renderSettings();

  // Assert
  await expect.element(getByText('2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('10', { exact: true })).toBeInTheDocument();
});

test('check for updates is disabled', async () => {
  // Arrange
  const { getByRole } = await renderSettings();

  // Assert
  await expect.element(getByRole('button', { name: 'Check for updates' })).toBeDisabled();
});
