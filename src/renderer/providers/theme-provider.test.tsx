// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { ThemeProvider, useTheme } from './theme-provider';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function stubSystemTheme(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    get matches() {
      return query === DARK_QUERY && dark;
    },
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'change') {
        listeners.add(listener);
      }
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'change') {
        listeners.delete(listener);
      }
    },
  }) as unknown as MediaQueryList);
  return {
    listenerCount: () => listeners.size,
    changeTo: (nextDark: boolean) => {
      dark = nextDark;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function renderTheme(props: { storageKey?: string; defaultTheme?: 'light' | 'dark' | 'system'; darkModeClass?: string } = {}) {
  const wrapper = ({ children }: PropsWithChildren) => <ThemeProvider {...props}>{children}</ThemeProvider>;
  return renderHook(() => useTheme(), { wrapper });
}

const isDarkClassSet = (className = 'dark-mode') => document.documentElement.classList.contains(className);

beforeEach(() => {
  window.electron = {
    ipcRenderer: { invoke: vi.fn(), on: vi.fn(() => vi.fn()), sendMessage: vi.fn(), once: vi.fn() },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove('dark-mode', 'night');
});

describe('ThemeProvider', () => {
  test('follows a light system theme when nothing is stored', async () => {
    // Arrange
    stubSystemTheme(false);

    // Act
    const { result } = await renderTheme();

    // Assert
    expect(result.current).toMatchObject({ theme: 'system', resolvedTheme: 'light' });
    expect(isDarkClassSet()).toBe(false);
    expect(localStorage.getItem('ui-theme')).toBeNull();
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('app:set-window-theme', 'light');
  });

  test('follows a dark system theme without storing it', async () => {
    // Arrange
    stubSystemTheme(true);

    // Act
    const { result } = await renderTheme();

    // Assert
    expect(result.current).toMatchObject({ theme: 'system', resolvedTheme: 'dark' });
    expect(isDarkClassSet()).toBe(true);
    expect(localStorage.getItem('ui-theme')).toBeNull();
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('app:set-window-theme', 'dark');
  });

  test('starts with the stored theme, whatever the system theme is', async () => {
    // Arrange
    stubSystemTheme(false);
    localStorage.setItem('ui-theme', 'dark');

    // Act
    const { result } = await renderTheme();

    // Assert
    expect(result.current).toMatchObject({ theme: 'dark', resolvedTheme: 'dark' });
    expect(isDarkClassSet()).toBe(true);
  });

  test('starts with the default theme when nothing is stored', async () => {
    // Arrange
    stubSystemTheme(false);

    // Act
    const { result } = await renderTheme({ defaultTheme: 'dark' });

    // Assert
    expect(result.current).toMatchObject({ theme: 'dark', resolvedTheme: 'dark' });
    expect(localStorage.getItem('ui-theme')).toBe('dark');
  });

  test('choosing a theme applies it, stores it and tells the window', async () => {
    // Arrange
    stubSystemTheme(true);
    const { result, act } = await renderTheme();

    // Act
    await act(() => result.current.setTheme('light'));

    // Assert
    expect(result.current).toMatchObject({ theme: 'light', resolvedTheme: 'light' });
    expect(isDarkClassSet()).toBe(false);
    expect(localStorage.getItem('ui-theme')).toBe('light');
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenLastCalledWith('app:set-window-theme', 'light');
  });

  test('going back to the system theme forgets the stored choice', async () => {
    // Arrange
    stubSystemTheme(false);
    const { result, act } = await renderTheme();
    await act(() => result.current.setTheme('dark'));
    expect(localStorage.getItem('ui-theme')).toBe('dark');

    // Act
    await act(() => result.current.setTheme('system'));

    // Assert
    expect(localStorage.getItem('ui-theme')).toBeNull();
    expect(result.current).toMatchObject({ theme: 'system', resolvedTheme: 'light' });
    expect(isDarkClassSet()).toBe(false);
  });

  test('uses the given storage key and dark class', async () => {
    // Arrange
    stubSystemTheme(false);
    localStorage.setItem('custom-theme', 'dark');

    // Act
    await renderTheme({ storageKey: 'custom-theme', darkModeClass: 'night' });

    // Assert
    expect(isDarkClassSet('night')).toBe(true);
    expect(isDarkClassSet()).toBe(false);
    expect(localStorage.getItem('ui-theme')).toBeNull();
  });

  test('a change of the system theme applies while the theme is system', async () => {
    // Arrange
    const system = stubSystemTheme(false);
    const { result, act } = await renderTheme();

    // Act
    await act(() => system.changeTo(true));

    // Assert
    expect(result.current.resolvedTheme).toBe('dark');
    expect(isDarkClassSet()).toBe(true);
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenLastCalledWith('app:set-window-theme', 'dark');
  });

  test('a change of the system theme does not override a chosen theme', async () => {
    // Arrange
    const system = stubSystemTheme(false);
    const { result, act } = await renderTheme();
    await act(() => result.current.setTheme('light'));
    vi.mocked(window.electron.ipcRenderer.sendMessage).mockClear();

    // Act
    await act(() => system.changeTo(true));

    // Assert
    expect(result.current.resolvedTheme).toBe('light');
    expect(isDarkClassSet()).toBe(false);
    expect(window.electron.ipcRenderer.sendMessage).not.toHaveBeenCalled();
  });

  test('stops listening to the system theme on unmount and when the theme changes', async () => {
    // Arrange
    const system = stubSystemTheme(false);
    const { result, act, unmount } = await renderTheme();
    expect(system.listenerCount()).toBe(1);

    // Act
    await act(() => result.current.setTheme('dark'));

    // Assert
    expect(system.listenerCount()).toBe(1);

    // Act
    await unmount();

    // Assert
    expect(system.listenerCount()).toBe(0);
  });
});
