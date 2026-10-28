// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PreferencesProvider, usePreferences } from './preferences-provider';
import { ThemeProvider, useTheme } from './theme-provider';
import { useUsageReporting } from './usage-reporting';
import { renderHookInWorkspace } from '../lib/test/render-hook-in-workspace';

function Providers({ children }: PropsWithChildren) {
  return (
    <PreferencesProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </PreferencesProvider>
  );
}

function useReporting() {
  useUsageReporting();
  return { preferences: usePreferences(), theme: useTheme() };
}

const DEFAULT_PREFERENCES = {
  density: 'Cards',
  hideReadItems: false,
  markReadOnScroll: true,
  openLinksExternally: false,
  keyboardNavigation: true,
};

function sentMessages(channel: string): unknown[] {
  return vi.mocked(window.electron.ipcRenderer.sendMessage).mock.calls.filter(([sent]) => sent === channel).map(([, payload]) => payload);
}

beforeEach(() => {
  window.electron = {
    ipcRenderer: { invoke: vi.fn(), on: vi.fn(() => vi.fn()), sendMessage: vi.fn(), once: vi.fn() },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark-mode');
});

test('reports the display settings together with the theme on start', async () => {
  // Act
  await renderHookInWorkspace(useReporting, { wrapper: Providers });

  // Assert
  expect(sentMessages('usage:preferences')).toEqual([{ ...DEFAULT_PREFERENCES, theme: 'system' }]);
});

test('reports again when a preference or the theme changes', async () => {
  // Arrange
  const { result } = await renderHookInWorkspace(useReporting, { wrapper: Providers });

  // Act
  await act(async () => result.current.preferences.setPreference('hideReadItems', true));
  await act(async () => result.current.theme.setTheme('dark'));

  // Assert
  expect(sentMessages('usage:preferences')).toEqual([
    { ...DEFAULT_PREFERENCES, theme: 'system' },
    { ...DEFAULT_PREFERENCES, hideReadItems: true, theme: 'system' },
    { ...DEFAULT_PREFERENCES, hideReadItems: true, theme: 'dark' },
  ]);
});

test('counts a switch of workspace, and nothing on start or on a render in the same workspace', async () => {
  // Arrange
  const { result, goToWorkspace } = await renderHookInWorkspace(useReporting, { wrapper: Providers });
  expect(sentMessages('usage:record')).toEqual([]);

  // Act
  await act(async () => result.current.preferences.setPreference('density', 'Compact'));

  // Assert
  expect(sentMessages('usage:record')).toEqual([]);

  // Act
  await goToWorkspace(3);
  await goToWorkspace(1);

  // Assert
  expect(sentMessages('usage:record')).toEqual([{ counter: 'workspaces_switched' }, { counter: 'workspaces_switched' }]);
});
