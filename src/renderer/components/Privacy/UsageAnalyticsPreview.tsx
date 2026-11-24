// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Heading } from 'react-aria-components';
import { Dialog, Modal, ModalOverlay } from '@/components/untitled-ui/application/modals/modal';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { ipc, rendererLogger } from '@/lib/ipc-client';
import type { DailySummaryProps, ErrorReportSample } from '../../../shared/contracts';
import { dialogHeaderClass, dialogTitleClass } from '@/components/common/dialog-classes';

export interface UsageAnalyticsPreviewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UsageAnalyticsPreview({ isOpen, onOpenChange }: UsageAnalyticsPreviewProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [summary, setSummary] = useState<DailySummaryProps>();
  const [sample, setSample] = useState<ErrorReportSample>();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    ipc.invoke('analytics:preview')
      .then(setSummary)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not load the usage stats preview' }, error));
    ipc.invoke('report:preview-sample')
      .then(setSample)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not load the error report preview' }, error));
  }, [isOpen]);

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className="w-full max-w-[520px] overflow-hidden">
        <Dialog className="rounded-[inherit]">
          <div className={dialogHeaderClass}>
            <Heading slot="title" className={dialogTitleClass}>{t('settings:analyticsPreview.title')}</Heading>
            <p className="text-sm text-tertiary">
              {t('settings:analyticsPreview.body')}
            </p>
          </div>
          <pre aria-label={t('settings:analyticsPreview.preview')} className="mx-6 max-h-[320px] overflow-auto rounded-lg bg-secondary p-3 text-xs text-secondary">
            {summary ? JSON.stringify(summary, null, 2) : t('settings:analyticsPreview.loading')}
          </pre>
          <div className={dialogHeaderClass}>
            <h3 className="text-md font-semibold text-primary">{t('settings:analyticsPreview.errorTitle')}</h3>
            <p className="text-sm text-tertiary">
              {t('settings:analyticsPreview.errorBody')}
            </p>
          </div>
          <pre aria-label={t('settings:analyticsPreview.errorPreview')} className="mx-6 max-h-[320px] overflow-auto rounded-lg bg-secondary p-3 text-xs text-secondary">
            {sample ? JSON.stringify(sample, null, 2) : t('settings:analyticsPreview.loading')}
          </pre>
          <div className="flex justify-end border-t border-secondary px-6 py-4 mt-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => onOpenChange(false)}>{t('common:action.close')}</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
