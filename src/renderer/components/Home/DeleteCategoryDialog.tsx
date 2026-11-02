// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, useEffectEvent, useState } from "react";
import { Heading } from "react-aria-components";
import NativeSelect from "@/components/common/NativeSelect";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useDeleteCategory } from "@/providers/feeds-provider";
import type { DeleteCategoryError } from "../../../shared/contracts";
import type { FeedCategory } from "../../../shared/contracts";

export interface DeleteCategoryDialogProps {
  category: FeedCategory | null;
  feedCount: number;
  otherCategories: FeedCategory[];
  onOpenChange: (open: boolean) => void;
  onDeleted: (categoryId: number) => void;
}

interface MoveFeedsOptionProps {
  otherCategories: FeedCategory[];
  moveFeeds: boolean;
  onMoveFeedsChange: (moveFeeds: boolean) => void;
  reassignTo: number | undefined;
  onReassignToChange: (categoryId: number) => void;
}

function MoveFeedsOption({ otherCategories, moveFeeds, onMoveFeedsChange, reassignTo, onReassignToChange }: MoveFeedsOptionProps) {
  return (
    <div className="flex flex-col gap-2.5 px-6 pb-4.5">
      <label htmlFor="move-feeds-toggle" className="flex items-center gap-2 text-sm font-medium text-secondary">
        <input
          id="move-feeds-toggle"
          type="checkbox"
          checked={moveFeeds}
          onChange={(event) => onMoveFeedsChange(event.target.checked)}
        />
        Keep its feeds and move them to another folder instead
      </label>
      {moveFeeds && (
        <NativeSelect
          aria-label="Move its feeds to"
          value={reassignTo}
          onChange={(event) => onReassignToChange(Number(event.target.value))}
        >
          {otherCategories.map((other) => (
            <option key={other.id} value={other.id}>{other.name}</option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}

export default function DeleteCategoryDialog({ category, feedCount, otherCategories, onOpenChange, onDeleted }: DeleteCategoryDialogProps) {
  const deleteCategory = useDeleteCategory();
  const [reassignTo, setReassignTo] = useState<number | undefined>(otherCategories[0]?.id);
  const [moveFeeds, setMoveFeeds] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DeleteCategoryError | null>(null);
  const resetDestination = useEffectEvent(() => {
    setReassignTo(otherCategories[0]?.id);
    setMoveFeeds(false);
  });

  // A fresh dialog target needs its own default destination; refreshing on every `otherCategories`
  // render would stomp a selection the user just made while nothing else about the request changed.
  useEffect(() => {
    resetDestination();
  }, [category?.id]);

  const needsReassignment = feedCount > 0;
  const shouldMove = needsReassignment && moveFeeds && otherCategories.length > 0;

  async function handleConfirm() {
    if (!category) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const response = await deleteCategory(category.id, shouldMove ? reassignTo : undefined);

    setIsLoading(false);
    if (response.success) {
      onDeleted(category.id);
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
    <ModalOverlay isOpen={category !== null} onOpenChange={handleOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">
              Delete folder
            </Heading>
            {category && (
              <p className="text-sm text-tertiary">
                This removes the <span className="font-semibold text-secondary">{category.name}</span> folder.
                {needsReassignment && (
                  <>
                    {" "}Its <span className="font-semibold text-secondary">{feedCount} {feedCount === 1 ? "feed" : "feeds"}</span> {shouldMove ? "move to the folder below." : "are deleted with it."}
                  </>
                )}
              </p>
            )}
          </div>

          {needsReassignment && otherCategories.length > 0 && (
            <MoveFeedsOption
              otherCategories={otherCategories}
              moveFeeds={moveFeeds}
              onMoveFeedsChange={setMoveFeeds}
              reassignTo={reassignTo}
              onReassignToChange={setReassignTo}
            />
          )}

          {error && <p className="px-6 pb-2 text-sm text-error-primary">{error.message}</p>}

          <div className="flex items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isLoading} onPress={handleConfirm}>
              Delete folder
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
