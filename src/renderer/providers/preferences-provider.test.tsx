// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { PreferencesProvider, usePreferences } from './preferences-provider';

afterEach(() => {
  localStorage.clear();
});

test('keeps the same context value while the preferences are unchanged', async () => {
  // Arrange
  const seen: ReturnType<typeof usePreferences>[] = [];
  function Probe() {
    seen.push(usePreferences());
    return null;
  }
  const { rerender } = await render(<PreferencesProvider><Probe /></PreferencesProvider>);
  const rendersBefore = seen.length;

  // Act
  await rerender(<PreferencesProvider><Probe /></PreferencesProvider>);

  // Assert
  expect(seen.length).toBeGreaterThan(rendersBefore);
  expect(seen.at(-1)).toBe(seen[rendersBefore - 1]);
});

test('hands out a new value when a preference changes', async () => {
  // Arrange
  const seen: ReturnType<typeof usePreferences>[] = [];
  function Probe() {
    seen.push(usePreferences());
    return null;
  }
  await render(<PreferencesProvider><Probe /></PreferencesProvider>);
  const before = seen.at(-1);

  // Act
  before?.setPreference('density', before.preferences.density === 'Compact' ? 'Cards' : 'Compact');

  // Assert
  await expect.poll(() => seen.at(-1)?.preferences.density).not.toBe(before?.preferences.density);
  expect(seen.at(-1)).not.toBe(before);
});
