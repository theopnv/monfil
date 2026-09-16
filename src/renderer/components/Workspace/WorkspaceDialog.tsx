import { useState } from "react";
import { Heading } from "react-aria-components";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { cx } from "@/components/untitled-ui/utils/cx";
import { WORKSPACE_COLORS, WORKSPACE_ICONS, workspaceIconComponent, type WorkspaceIconName } from "@/lib/workspace-icons";
import { useCreateWorkspace } from "@/providers/workspace-provider";
import type { CreateWorkspaceError } from "../../../main/db/crud/insert";

const DEFAULT_ICON = WORKSPACE_ICONS[0];
const DEFAULT_COLOR = WORKSPACE_COLORS[0];

export interface WorkspaceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WorkspaceDialog({ isOpen, onOpenChange }: WorkspaceDialogProps) {
  const createWorkspace = useCreateWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<WorkspaceIconName>(DEFAULT_ICON);
  const [color, setColor] = useState<(typeof WORKSPACE_COLORS)[number]>(DEFAULT_COLOR);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CreateWorkspaceError | null>(null);

  function reset() {
    setName('');
    setIcon(DEFAULT_ICON);
    setColor(DEFAULT_COLOR);
    setError(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const result = await createWorkspace({ name: trimmed, icon, color });

    setIsLoading(false);
    if (result.success) {
      handleOpenChange(false);
      void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(result.data.id) } });
    } else {
      setError(result.error);
    }
  }

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">
              New workspace
            </Heading>
            <p className="text-sm text-tertiary">A tab in the rail, with its own sources and its own river.</p>
          </div>

          <div className="flex flex-col gap-4 px-6 pb-4.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="workspace-name" className="text-sm font-medium text-secondary">Name</label>
              <input
                id="workspace-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreate();
                  }
                }}
                placeholder="CI/CD watch"
                className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-secondary">Icon</span>
              <div className="grid grid-cols-6 gap-1.5">
                {WORKSPACE_ICONS.map((candidate) => {
                  const Icon = workspaceIconComponent(candidate);
                  const isSelected = icon === candidate;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      aria-label={candidate}
                      aria-pressed={isSelected}
                      onClick={() => setIcon(candidate)}
                      className={cx(
                        "flex size-8 items-center justify-center rounded-lg text-tertiary hover:bg-primary_hover",
                        isSelected && "bg-primary_hover text-primary ring-2 ring-inset ring-brand",
                      )}
                    >
                      <Icon aria-hidden className="size-4.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-secondary">Colour</span>
              <div className="flex flex-wrap gap-2">
                {WORKSPACE_COLORS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    aria-label={`Colour ${candidate}`}
                    aria-pressed={color === candidate}
                    onClick={() => setColor(candidate)}
                    style={{ backgroundColor: candidate }}
                    className={cx("size-7 flex-none rounded-full ring-2 ring-offset-2 ring-offset-primary", color === candidate ? "ring-brand" : "ring-transparent")}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && <p className="px-6 pb-2 text-sm text-error-primary">{error.message}</p>}

          <div className="flex items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button color="primary" size="md" className="rounded-full" isLoading={isLoading} isDisabled={!name.trim()} onPress={handleCreate}>
              Create workspace
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
