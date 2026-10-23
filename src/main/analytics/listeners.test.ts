// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { listenToUsagePreferences, listenToUsageRecord } from '../ipc/listeners';
import { incrementCounter } from './counters';
import { getPreferencesSnapshot, setPreferencesSnapshot } from './preferences';
import type { UsagePreferences } from '../../shared/contracts';

vi.mock(import('electron'), () => ({}) as never);
vi.mock(import('./counters'), () => ({ incrementCounter: vi.fn() }));
vi.mock(import('../db/database'), () => ({}) as never);
vi.mock(import('../updates/auto-updater'), () => ({}) as never);
vi.mock(import('../logging/logger'), () => ({}) as never);

const event = {} as Electron.IpcMainEvent;
const preferences: UsagePreferences = { density: 'Compact', theme: 'system', hideReadItems: false, markReadOnScroll: true, openLinksExternally: true, keyboardNavigation: false };

describe('renderer usage listeners', () => {
  test('counts an allowed renderer counter', () => {
    // Act
    listenToUsageRecord(event, { counter: 'searches' });

    // Assert
    expect(incrementCounter).toHaveBeenCalledExactlyOnceWith('searches');
  });

  test.each([{ counter: 'articles_opened' }, { counter: 'searches', extra: 1 }, null, 'searches'])('ignores %j', (payload) => {
    // Act
    listenToUsageRecord(event, payload as never);

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });

  test('keeps a valid preferences snapshot and ignores an invalid one', () => {
    // Act
    listenToUsagePreferences(event, preferences);
    listenToUsagePreferences(event, { ...preferences, density: 'Huge' } as never);

    // Assert
    expect(getPreferencesSnapshot()).toEqual(preferences);
    setPreferencesSnapshot(preferences);
  });
});
