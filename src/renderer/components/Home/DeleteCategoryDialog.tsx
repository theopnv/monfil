// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Trans, useTranslation } from 'react-i18next';
import { ErrorText } from "@/components/errors/ErrorText";
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
  const { t } = useTranslation('river');
  return (
    <div className="flex flex-col gap-2.5 px-6 pb-4.5">
      <label htmlFor="move-feeds-toggle" className="flex items-center gap-2 text-sm font-medium text-secondary">
        <input
          id="move-feeds-toggle"
          type="checkbox"
          checked={moveFeeds}
          onChange={(event) => onMoveFeedsChange(event.target.checked)}
        />
        {t('deleteCategory.keepFeeds')}
      </label>
      {moveFeeds && (
        <NativeSelect
          aria-label={t('deleteCategory.moveTo')}
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
  const { t } = useTranslation(['river', 'common']);
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
              {t('river:deleteCategory.title')}
            </Heading>
            {category && (
              <p className="text-sm text-tertiary">
                <Trans t={t} i18nKey="river:deleteCategory.body" values={{ name: category.name }} components={{ bold: <span className="font-semibold text-secondary" /> }} />
                {needsReassignment && (
                  <>
                    {" "}
                    <Trans t={t} i18nKey="river:deleteCategory.feeds" context={shouldMove ? "move" : "delete"} count={feedCount} components={{ bold: <span className="font-semibold text-secondary" /> }} />
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

          {error && <ErrorText error={error} className="px-6 pb-2 text-sm text-error-primary" />}

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isLoading} onPress={handleConfirm}>
              {t('river:deleteCategory.confirm')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
