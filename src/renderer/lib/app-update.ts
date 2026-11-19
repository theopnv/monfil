// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useEffectEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ipc } from '@/lib/ipc-client';
import { notifyAction } from '@/lib/notifications';
import { queryKeys } from '@/lib/queries';
import type { AppUpdateState } from '../../shared/contracts';

/** Offers a restart once the main process has downloaded an update. Mount once, under the IPC bridge. */
export function useUpdateNotification(): void {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.updateState,
    queryFn: (): Promise<AppUpdateState> => ipc.invoke('app:get-update-state', undefined),
    staleTime: Infinity,
  });
  const isReady = data?.name === 'READY_TO_INSTALL';
  // The prompt shows once per update. A language change must not raise it again.
  const offerRestart = useEffectEvent(() => notifyAction(t('update.ready'), 'app-update-ready', {
    label: t('action.restart'),
    onClick: () => ipc.send('app:install-update', undefined),
  }));

  useEffect(() => {
    if (isReady) {
      offerRestart();
    }
  }, [isReady]);
}
