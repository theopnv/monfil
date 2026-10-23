// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Heading } from 'react-aria-components';
import { Dialog, Modal, ModalOverlay } from '@/components/untitled-ui/application/modals/modal';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { WORKSPACE_COLORS, WORKSPACE_ICONS } from '@/lib/workspace-icons';
import { useInstallFeedpack } from '@/providers/feedpacks-provider';
import type { FeedpackInstallTarget, FeedpackPreview } from '../../../shared/contracts';
import FeedpackBrowser from './FeedpackBrowser';

export interface FeedpackInstallDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: number;
  /** Name, icon and colour typed or picked in the new-workspace form before browsing; used when installing into a new workspace. */
  newWorkspaceDraft?: { name: string; icon: string; color: string } | undefined;
}

export default function FeedpackInstallDialog({ isOpen, onOpenChange, workspaceId, newWorkspaceDraft }: FeedpackInstallDialogProps) {
  const install = useInstallFeedpack();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<FeedpackPreview | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setError(null);
    }
  }, [isOpen]);

  function select(selection: FeedpackPreview | null) {
    setSelected(selection);
    setError(null);
  }

  async function installSelected() {
    if (!selected) {
      return;
    }
    setIsInstalling(true);
    setError(null);
    const target: FeedpackInstallTarget = workspaceId === undefined
      ? { kind: 'new-workspace', name: newWorkspaceDraft?.name.trim() || selected.pack.title, icon: newWorkspaceDraft?.icon ?? WORKSPACE_ICONS[0], color: newWorkspaceDraft?.color ?? WORKSPACE_COLORS[0] }
      : { kind: 'merge-workspace', workspaceId };
    const result = await install(selected.pack.slug, target);
    setIsInstalling(false);
    if (result.success) {
      onOpenChange(false);
      void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(result.data.workspaceId) } });
    } else {
      setError(result.error.message);
    }
  }

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden">
        <Dialog className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">Feedpacks</Heading>
            <p className="text-sm text-tertiary">Install a curated set of sources.</p>
          </div>

          <FeedpackBrowser isActive={isOpen} selected={selected} onSelect={select} />

          {error && <p className="px-6 pb-2 text-sm text-error-primary">{error}</p>}
          <div className="flex items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
            {selected && <Button color="secondary" size="md" className="mr-auto" onPress={() => select(null)}>Back to feedpacks</Button>}
            <Button color="secondary" size="md" onPress={() => onOpenChange(false)}>Close</Button>
            {selected && <Button color="primary" size="md" isLoading={isInstalling} onPress={installSelected}>Install</Button>}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
