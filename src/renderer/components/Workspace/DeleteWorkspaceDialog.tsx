import { useState } from "react";
import { Heading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useExportOpml } from "@/providers/opml-provider";
import { useDeleteWorkspace } from "@/providers/workspace-provider";
import type { WorkspaceSummary } from "../../../preload/channels";

export interface DeleteWorkspaceDialogProps {
  workspace: WorkspaceSummary | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (workspaceId: number) => void;
}

export default function DeleteWorkspaceDialog({ workspace, onOpenChange, onDeleted }: DeleteWorkspaceDialogProps) {
  const exportOpml = useExportOpml();
  const deleteWorkspace = useDeleteWorkspace();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(result.error.message);
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
      setError(response.error.message);
    }
  }

  return (
    <ModalOverlay isOpen={workspace !== null} onOpenChange={handleOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">
              Delete workspace
            </Heading>
            {workspace && (
              <p className="text-sm text-tertiary">
                This deletes the <span className="font-semibold text-secondary">{workspace.name}</span> workspace and its folders.
                Feeds placed only here are removed too. Export as OPML first to keep a copy you can re-import later.
              </p>
            )}
          </div>

          {error && <p className="px-6 pb-2 text-sm text-error-primary">{error}</p>}

          <div className="flex items-center justify-between gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" isLoading={isExporting} onPress={handleExport}>
              Export as OPML
            </Button>
            <div className="flex items-center gap-2.5">
              <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isDeleting} onPress={handleDelete}>
                Delete workspace
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
