// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useState } from "react";
import { Heading } from "react-aria-components";
import { useQuery } from "@tanstack/react-query";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import NativeSelect from "@/components/common/NativeSelect";
import { categoriesQuery } from "@/lib/queries";
import { useActiveWorkspaceId, useMoveFeedToWorkspace, useWorkspaces } from "@/providers/workspace-provider";
import type { FeedSummary } from "../../../shared/contracts";

const NEW_FOLDER = "";
const FIELD_CLASSES = "rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary";

export interface MoveFeedDialogProps {
  feed: FeedSummary | null;
  onOpenChange: (open: boolean) => void;
}

function MoveFeedForm({ feed, onClose }: { feed: FeedSummary; onClose: () => void }) {
  const activeId = useActiveWorkspaceId();
  const moveFeedToWorkspace = useMoveFeedToWorkspace();
  const destinations = useWorkspaces().filter((workspace) => workspace.id !== activeId);
  const [chosenDestinationId, setChosenDestinationId] = useState<number | null>(null);
  const destinationId = chosenDestinationId ?? destinations[0]?.id;
  const [folderChoice, setFolderChoice] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState(feed.category.name);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: categories = [] } = useQuery({ ...categoriesQuery(destinationId ?? 0), enabled: destinationId !== undefined });

  const folderNames = categories.map((category) => category.name);
  const folder = folderChoice ?? (folderNames.includes(feed.category.name) ? feed.category.name : NEW_FOLDER);
  const categoryName = (folder === NEW_FOLDER ? newFolderName : folder).trim();
  const canMove = destinationId !== undefined && categoryName !== "";

  async function handleConfirm() {
    if (destinationId === undefined || categoryName === "") {
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await moveFeedToWorkspace(feed.id, activeId, destinationId, categoryName);
    setIsLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error.message);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
        <Heading slot="title" className="font-display text-lg font-semibold text-primary">
          Move feed
        </Heading>
        <p className="text-sm text-tertiary">
          Move <span className="font-semibold text-secondary">{feed.title}</span> to another workspace.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 px-6 pb-4.5">
        <label htmlFor="move-feed-workspace" className="text-sm font-medium text-secondary">Workspace</label>
        <NativeSelect
          id="move-feed-workspace"
          value={destinationId}
          onChange={(event) => {
            setChosenDestinationId(Number(event.target.value));
            setFolderChoice(null);
          }}
        >
          {destinations.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5 px-6 pb-4.5">
        <label htmlFor="move-feed-folder" className="text-sm font-medium text-secondary">Folder</label>
        <NativeSelect id="move-feed-folder" value={folder} onChange={(event) => setFolderChoice(event.target.value)}>
          {folderNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option value={NEW_FOLDER}>New folder…</option>
        </NativeSelect>
        {folder === NEW_FOLDER && (
          <input
            aria-label="New folder name"
            className={FIELD_CLASSES}
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
          />
        )}
      </div>

      {error && <p className="px-6 pb-2 text-sm text-error-primary">{error}</p>}

      <div className="flex items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
        <Button color="secondary" size="md" className="rounded-full" onPress={onClose}>
          Cancel
        </Button>
        <Button color="primary" size="md" className="rounded-full" isLoading={isLoading} isDisabled={!canMove} onPress={handleConfirm}>
          Move feed
        </Button>
      </div>
    </>
  );
}

export default function MoveFeedDialog({ feed, onOpenChange }: MoveFeedDialogProps) {
  return (
    <ModalOverlay isOpen={feed !== null} onOpenChange={onOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          {feed && <MoveFeedForm key={feed.id} feed={feed} onClose={() => onOpenChange(false)} />}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
