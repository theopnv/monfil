// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, useState } from 'react';
import { Heading } from 'react-aria-components';
import { Dialog, Modal, ModalOverlay } from '@/components/untitled-ui/application/modals/modal';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { ipc, rendererLogger } from '@/lib/ipc-client';
import type { DailySummaryProps } from '../../../shared/contracts';

export interface UsageAnalyticsPreviewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UsageAnalyticsPreview({ isOpen, onOpenChange }: UsageAnalyticsPreviewProps) {
  const [summary, setSummary] = useState<DailySummaryProps>();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    ipc.invoke('analytics:preview', undefined)
      .then(setSummary)
      .catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not load the usage stats preview' }, error));
  }, [isOpen]);

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className="w-full max-w-[520px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">What is sent</Heading>
            <p className="text-sm text-tertiary">
              Monfil sends one summary like this for each day you use it. It holds counts and settings. It holds no feed, article, search text, or name.
            </p>
          </div>
          <pre aria-label="Usage stats preview" className="mx-6 max-h-[320px] overflow-auto rounded-lg bg-secondary p-3 text-xs text-secondary">
            {summary ? JSON.stringify(summary, null, 2) : 'Loading…'}
          </pre>
          <div className="flex justify-end border-t border-secondary px-6 py-4 mt-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => onOpenChange(false)}>Close</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
