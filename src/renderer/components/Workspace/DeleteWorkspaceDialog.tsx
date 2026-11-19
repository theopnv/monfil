// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Trans, useTranslation } from 'react-i18next';
import { ErrorText } from "@/components/errors/ErrorText";
import type { CodedError } from "../../../shared/errors";
import { useState } from "react";
import { Heading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<CodedError | null>(null);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setError(null);
    }
    onOpenChange(open);
  }

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

  async function handleDelete() {
    if (!workspace) {
      return;
    }
    setIsDeleting(true);
    setError(null);

    const response = await deleteWorkspace(workspace.id);

    setIsDeleting(false);
    if (response.success) {
      onDeleted(workspace.id);
      handleOpenChange(false);
    } else {
      setError(response.error);
    }
  }

  return (
    <ModalOverlay isOpen={workspace !== null} onOpenChange={handleOpenChange} isDismissable>
      <Modal className="w-full max-w-[580px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">
              {t('workspace:delete.title')}
            </Heading>
            {workspace && (
              <p className="text-sm text-tertiary">
                <Trans t={t} i18nKey="workspace:delete.body" values={{ name: workspace.name }} components={{ bold: <span className="font-semibold text-secondary" /> }} />
              </p>
            )}
          </div>

          {error && <ErrorText error={error} className="px-6 pb-2 text-sm text-error-primary" />}

          <div className="flex items-center justify-between gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" isLoading={isExporting} onPress={handleExport}>
              {t('workspace:delete.export')}
            </Button>
            <div className="flex items-center gap-2.5">
              <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
                {t('common:action.cancel')}
              </Button>
              <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isDeleting} onPress={handleDelete}>
                {t('workspace:delete.confirm')}
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
