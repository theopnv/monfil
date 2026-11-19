// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useEffectEvent, useState } from "react";
import { Heading } from "react-aria-components";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { cx } from "@/components/untitled-ui/utils/cx";
import { WORKSPACE_COLORS, WORKSPACE_ICONS, workspaceIconComponent, type WorkspaceIconName } from "@/lib/workspace-icons";
import { useCreateWorkspace, useUpdateWorkspace } from "@/providers/workspace-provider";
import { isComposing } from "@/lib/keyboard";
import type { CreateWorkspaceError } from "../../../shared/contracts";
import type { UpdateWorkspaceError } from "../../../shared/contracts";
import type { WorkspaceSummary } from "../../../shared/contracts";

const DEFAULT_ICON = WORKSPACE_ICONS[0];
const DEFAULT_COLOR = WORKSPACE_COLORS[0];

export interface WorkspaceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onBrowseFeedpacks?: (draft: { name: string; icon: WorkspaceIconName; color: string }) => void;
  /** The workspace to edit. Omitted, the dialog creates a new one. */
  workspace?: WorkspaceSummary;
}

export default function WorkspaceDialog({ isOpen, onOpenChange, workspace, onBrowseFeedpacks }: WorkspaceDialogProps) {
  const { t } = useTranslation(['workspace', 'common']);
  const createWorkspace = useCreateWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const navigate = useNavigate();
  const isEditing = workspace !== undefined;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<WorkspaceIconName>(DEFAULT_ICON);
  const [color, setColor] = useState<(typeof WORKSPACE_COLORS)[number]>(DEFAULT_COLOR);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CreateWorkspaceError | UpdateWorkspaceError | null>(null);
  const resetForm = useEffectEvent(() => {
    setName(workspace?.name ?? '');
    setIcon((workspace?.icon as WorkspaceIconName | undefined) ?? DEFAULT_ICON);
    setColor((workspace?.color as (typeof WORKSPACE_COLORS)[number] | undefined) ?? DEFAULT_COLOR);
    setError(null);
  });

  // Seeds on open rather than on close: the form must show the workspace passed in for *this*
  // open, and a right-click can retarget `workspace` between one open and the next.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    resetForm();
  }, [isOpen, workspace?.id]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const result = isEditing
      ? await updateWorkspace(workspace.id, { name: trimmed, icon, color })
      : await createWorkspace({ name: trimmed, icon, color });

    setIsLoading(false);
    if (result.success) {
      onOpenChange(false);
      if (!isEditing) {
        void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(result.data.id) } });
      }
    } else {
      setError(result.error);
    }
  }

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">
              {isEditing ? t('workspace:dialog.editTitle') : t('workspace:dialog.newTitle')}
            </Heading>
            <p className="text-sm text-tertiary">
              {isEditing ? t('workspace:dialog.editBody') : t('workspace:dialog.newBody')}
            </p>
          </div>

          <div className="flex flex-col gap-4 px-6 pb-4.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="workspace-name" className="text-sm font-medium text-secondary">{t('workspace:dialog.name')}</label>
              <input
                id="workspace-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isComposing(event.nativeEvent)) {
                    void handleSubmit();
                  }
                }}
                placeholder={t('workspace:dialog.namePlaceholder')}
                className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-secondary">{t('workspace:dialog.icon')}</span>
              <div className="grid grid-cols-8 gap-1.5">
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
              <span className="text-sm font-medium text-secondary">{t('workspace:dialog.colour')}</span>
              <div className="grid grid-cols-8 gap-2">
                {WORKSPACE_COLORS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    aria-label={t('workspace:dialog.colourOption', { value: candidate })}
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
            {!isEditing && onBrowseFeedpacks && (
              <Button color="secondary" size="md" className="rounded-full" onPress={() => onBrowseFeedpacks({ name, icon, color })}>
                {t('workspace:dialog.browse')}
              </Button>
            )}
            <Button color="secondary" size="md" className="rounded-full" onPress={() => onOpenChange(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button color="primary" size="md" className="rounded-full" isLoading={isLoading} isDisabled={!name.trim()} onPress={handleSubmit}>
              {isEditing ? t('workspace:dialog.save') : t('workspace:dialog.create')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
