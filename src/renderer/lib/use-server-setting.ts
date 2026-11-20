// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback, useEffect, useState } from 'react';
import { ipc, rendererLogger } from '@/lib/ipc-client';
import type { SettingKey, SettingTypes } from '../../shared/channels';

interface Options<K extends SettingKey> {
  /** Shows the chosen value at once, and replaces it with the state main returns. Only for a setting whose value is its own state. */
  optimistic?: boolean;
  /** Runs with the state main returns after a save. */
  onSaved?: (state: SettingTypes[K]['state']) => unknown;
}

/** One setting that main stores: `undefined` until it loads, then its state, and a function that saves a new value. */
export function useServerSetting<K extends SettingKey>(key: K, { optimistic = false, onSaved }: Options<K> = {}): [SettingTypes[K]['state'] | undefined, (value: SettingTypes[K]['value']) => void] {
  const [state, setState] = useState<SettingTypes[K]['state']>();

  useEffect(() => {
    ipc.invoke('settings:get', { key })
      .then(setState)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: `Error loading the ${key} setting:` }, error));
  }, [key]);

  const save = useCallback((value: SettingTypes[K]['value']) => {
    if (optimistic) {
      setState(value as SettingTypes[K]['state']);
    }
    ipc.invoke('settings:set', { key, value })
      .then(async (next) => {
        setState(next);
        await onSaved?.(next);
      })
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: `Error saving the ${key} setting:` }, error));
  }, [key, optimistic, onSaved]);

  return [state, save];
}
