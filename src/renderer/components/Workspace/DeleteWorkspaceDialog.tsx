// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Trans, useTranslation } from 'react-i18next';
import { ConfirmDialog, useConfirmAction } from "@/components/common/ConfirmDialog";
import type { CodedError } from "../../../shared/errors";
import { useState } from "react";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useExportOpml } from "@/providers/opml-provider";
import { useDeleteWorkspace } from "@/providers/workspace-provider";
import type { WorkspaceSummary } from "../../../shared/contracts";

export interface DeleteWorkspaceDialogProps {
  workspace: WorkspaceSummary | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (workspaceId: number) => void;
}

export default function DeleteWorkspaceDialog({ workspace, onOpenChange, onDeleted }: DeleteWorkspaceDialogProps) {
  const { t } = useTranslation(['workspace', 'common']);
  const exportOpml = useExportOpml();
  const deleteWorkspace = useDeleteWorkspace();
  const [isExporting, setIsExporting] = useState(false);
  const { isLoading, error, setError, handleOpenChange, run } = useConfirmAction<CodedError>(onOpenChange);

  async function handleExport() {
    if (!workspace) {
      return;
    }
    setIsExporting(true);
    setError(null);

    const result = await exportOpml(workspace.id);

    setIsExporting(false);
    if (!result.success && result.error.name !== 'CANCELLED') {
      setError(result.error);
    }
  }

  function handleDelete() {
    if (workspace) {
      void run(() => deleteWorkspace({ workspaceId: workspace.id }), () => {
        onDeleted(workspace.id);
        handleOpenChange(false);
      });
    }
  }

  return (
    <ConfirmDialog
      isOpen={workspace !== null}
      onOpenChange={handleOpenChange}
      widthClass="max-w-[580px]"
      title={t('workspace:delete.title')}
      description={workspace && <Trans t={t} i18nKey="workspace:delete.body" values={{ name: workspace.name }} components={{ bold: <span className="font-semibold text-secondary" /> }} />}
      error={error}
      confirmLabel={t('workspace:delete.confirm')}
      isLoading={isLoading}
      onConfirm={handleDelete}
      footerStart={
        <Button color="secondary" size="md" className="rounded-full" isLoading={isExporting} onPress={handleExport}>
          {t('workspace:delete.export')}
        </Button>
      }
    />
  );
}
