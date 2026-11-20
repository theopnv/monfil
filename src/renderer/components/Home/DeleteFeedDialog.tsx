// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Trans, useTranslation } from 'react-i18next';
import { ConfirmDialog, useConfirmAction } from "@/components/common/ConfirmDialog";
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
  const { isLoading, error, handleOpenChange, run } = useConfirmAction<DeleteFeedError>(onOpenChange);
  const workspaceName = useActiveWorkspace()?.name ?? t('river:deleteFeed.thisWorkspace');
  const keepsItems = (feed?.otherWorkspaceCount ?? 0) > 0;

  function handleConfirm() {
    if (feed) {
      void run(() => deleteFeed({ feedId: feed.id }), () => {
        onDeleted(feed);
        onOpenChange(false);
      });
    }
  }

  const bold = { bold: <span className="font-semibold text-secondary" /> };
  let description;
  if (feed && keepsItems) {
    description = <Trans t={t} i18nKey="river:deleteFeed.removeBody" count={feed.otherWorkspaceCount} values={{ title: feed.title, workspace: workspaceName }} components={bold} />;
  } else if (feed) {
    description = <Trans t={t} i18nKey="river:deleteFeed.deleteBody" count={feed.itemCount} values={{ title: feed.title }} components={bold} />;
  }

  return (
    <ConfirmDialog
      isOpen={feed !== null}
      onOpenChange={handleOpenChange}
      widthClass="max-w-[440px]"
      title={keepsItems ? t('river:deleteFeed.titleRemove') : t('river:deleteFeed.titleDelete')}
      description={description}
      error={error}
      confirmLabel={keepsItems ? t('river:deleteFeed.confirmRemove', { workspace: workspaceName }) : t('river:deleteFeed.confirmDelete')}
      isLoading={isLoading}
      onConfirm={handleConfirm}
    />
  );
}
