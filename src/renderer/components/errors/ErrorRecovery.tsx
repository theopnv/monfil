// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { ipc } from '@/lib/ipc-client';
import { ErrorReportForm } from './ErrorReportForm';

interface ErrorRecoveryProps {
  error: unknown;
  onRetry: () => void | Promise<void>;
  onRestart?: () => void;
  onShowLog?: () => void;
  variant?: 'root' | 'route' | 'section';
  /** The incident ID of a failure that the renderer logged itself, so the error has none. */
  incidentId?: string;
}

function incidentFrom(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'incidentId' in error && typeof error.incidentId === 'string'
    ? error.incidentId.slice(0, 8)
    : undefined;
}

function RecoveryActions({ root, onRetry, onRestart, onShowLog }: Pick<ErrorRecoveryProps, 'onRetry' | 'onRestart' | 'onShowLog'> & { root: boolean }) {
  const { t } = useTranslation('errors');
  return (
    <div className="flex flex-wrap gap-2">
      <Button color="primary" onPress={() => void onRetry()}>{t('recovery.tryAgain')}</Button>
      {(root || onRestart) && <Button color="secondary" onPress={onRestart ?? (() => ipc.send('app:restart', undefined))}>{t('recovery.restart')}</Button>}
      {(root || onShowLog) && <Button color="secondary" onPress={onShowLog ?? (() => ipc.send('app:reveal', 'log'))}>{t('recovery.showLog')}</Button>}
    </div>
  );
}

export function ErrorRecovery({ error, onRetry, onRestart, onShowLog, variant = 'section', incidentId: ownIncidentId }: ErrorRecoveryProps) {
  const { t } = useTranslation('errors');
  const root = variant === 'root';
  const incidentId = ownIncidentId?.slice(0, 8) ?? incidentFrom(error);
  return (
    <section className={root ? 'flex h-screen w-screen items-center justify-center bg-primary p-8' : 'flex min-h-64 items-center justify-center p-8'}>
      <div className="flex max-w-lg flex-col items-start gap-4 rounded-xl border border-secondary bg-primary p-6 shadow-lg">
        <h1 className="font-display text-display-sm text-primary">
          {root ? t('recovery.rootTitle') : t('recovery.pageTitle')}
        </h1>
        <p className="text-sm text-tertiary">
          {t('recovery.hint', { incident: incidentId ?? t('recovery.unknownIncident') })}
        </p>
        <RecoveryActions root={root} onRetry={onRetry} {...(onRestart ? { onRestart } : {})} {...(onShowLog ? { onShowLog } : {})} />
        <ErrorReportForm incidentId={incidentId} />
      </div>
    </section>
  );
}
