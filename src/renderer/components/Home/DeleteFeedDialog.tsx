// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Trans, useTranslation } from 'react-i18next';
import { ErrorText } from "@/components/errors/ErrorText";
import { useState } from "react";
import { Heading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useDeleteFeed } from "@/providers/feeds-provider";
import { useActiveWorkspace } from "@/providers/workspace-provider";
import type { DeleteFeedError } from "../../../shared/contracts";
import type { FeedSummary } from "../../../shared/contracts";

export interface DeleteFeedDialogProps {
  feed: FeedSummary | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (feed: FeedSummary) => void;
}

export default function DeleteFeedDialog({ feed, onOpenChange, onDeleted }: DeleteFeedDialogProps) {
  const { t } = useTranslation(['river', 'common']);
  const deleteFeed = useDeleteFeed();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DeleteFeedError | null>(null);
  const workspaceName = useActiveWorkspace()?.name ?? t('river:deleteFeed.thisWorkspace');
  const keepsItems = (feed?.otherWorkspaceCount ?? 0) > 0;
  const confirmLabel = keepsItems ? t('river:deleteFeed.confirmRemove', { workspace: workspaceName }) : t('river:deleteFeed.confirmDelete');

  async function handleConfirm() {
    if (!feed) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const response = await deleteFeed(feed.id);

    setIsLoading(false);
    if (response.success) {
      onDeleted(feed);
      onOpenChange(false);
    } else {
      setError(response.error);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null);
    }
    onOpenChange(open);
  }

  return (
    <ModalOverlay isOpen={feed !== null} onOpenChange={handleOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">
              {keepsItems ? t('river:deleteFeed.titleRemove') : t('river:deleteFeed.titleDelete')}
            </Heading>
            {feed && keepsItems && (
              <p className="text-sm text-tertiary">
                <Trans t={t} i18nKey="river:deleteFeed.removeBody" count={feed.otherWorkspaceCount} values={{ title: feed.title, workspace: workspaceName }} components={{ bold: <span className="font-semibold text-secondary" /> }} />
              </p>
            )}
            {feed && !keepsItems && (
              <p className="text-sm text-tertiary">
                <Trans t={t} i18nKey="river:deleteFeed.deleteBody" count={feed.itemCount} values={{ title: feed.title }} components={{ bold: <span className="font-semibold text-secondary" /> }} />
              </p>
            )}
          </div>

          {error && <ErrorText error={error} className="px-6 pb-2 text-sm text-error-primary" />}

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isLoading} onPress={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
