// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Trans, useTranslation } from 'react-i18next';
import { useEffect, useEffectEvent, useState } from "react";
import { ConfirmDialog, useConfirmAction } from "@/components/common/ConfirmDialog";
import NativeSelect from "@/components/common/NativeSelect";
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
  const { isLoading, error, handleOpenChange, run } = useConfirmAction<DeleteCategoryError>(onOpenChange);
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

  function handleConfirm() {
    if (category) {
      void run(() => deleteCategory({ categoryId: category.id, reassignTo: shouldMove ? reassignTo : undefined }), () => {
        onDeleted(category.id);
        onOpenChange(false);
      });
    }
  }

  const bold = { bold: <span className="font-semibold text-secondary" /> };
  return (
    <ConfirmDialog
      isOpen={category !== null}
      onOpenChange={handleOpenChange}
      widthClass="max-w-[440px]"
      title={t('river:deleteCategory.title')}
      description={category && (
        <>
          <Trans t={t} i18nKey="river:deleteCategory.body" values={{ name: category.name }} components={bold} />
          {needsReassignment && (
            <>
              {" "}
              <Trans t={t} i18nKey="river:deleteCategory.feeds" context={shouldMove ? "move" : "delete"} count={feedCount} components={bold} />
            </>
          )}
        </>
      )}
      error={error}
      confirmLabel={t('river:deleteCategory.confirm')}
      isLoading={isLoading}
      onConfirm={handleConfirm}
    >
      {needsReassignment && otherCategories.length > 0 && (
        <MoveFeedsOption
          otherCategories={otherCategories}
          moveFeeds={moveFeeds}
          onMoveFeedsChange={setMoveFeeds}
          reassignTo={reassignTo}
          onReassignToChange={setReassignTo}
        />
      )}
    </ConfirmDialog>
  );
}
