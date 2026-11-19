// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useEffect, type PropsWithChildren } from 'react';
import { ipc } from '@/lib/ipc-client';
import { ErrorRecovery } from './ErrorRecovery';
import { notifyWarning } from '@/lib/notifications';

export function StartupGate({ children }: PropsWithChildren) {
  const { t } = useTranslation('errors');
  const queryClient = useQueryClient();
  const health = useQuery({ queryKey: ['startup-health'], queryFn: () => ipc.invoke('app:get-startup-health', undefined), retry: false });
  useEffect(() => {
    if (health.data?.name === 'RESET') {
      notifyWarning(t('startup.databaseRecovered'), 'database-recovered', {
        label: t('startup.revealBackup'),
        onClick: () => ipc.send('app:reveal-database-backup', undefined),
      });
    }
  }, [health.data, t]);
  if (health.isPending) {
    return <div className="flex h-screen items-center justify-center bg-primary text-primary">{t('startup.starting')}</div>;
  }
  if (health.isError || health.data?.name === 'FAILED') {
    const error = health.isError ? health.error : health.data;
    return (
      <ErrorRecovery error={error} variant="root" onRetry={async () => {
        await queryClient.resetQueries();
        await health.refetch();
      }} />
    );
  }
  return children;
}
