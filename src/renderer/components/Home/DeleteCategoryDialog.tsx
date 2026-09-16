import { useEffect, useState } from "react";
import { Heading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useDeleteCategory } from "@/providers/feeds-provider";
import type { DeleteCategoryError } from "../../../main/db/crud/delete";
import type { FeedCategory } from "../../../preload/channels";

export interface DeleteCategoryDialogProps {
  category: FeedCategory | null;
  feedCount: number;
  otherCategories: FeedCategory[];
  onOpenChange: (open: boolean) => void;
  onDeleted: (categoryId: number) => void;
}

export default function DeleteCategoryDialog({ category, feedCount, otherCategories, onOpenChange, onDeleted }: DeleteCategoryDialogProps) {
  const deleteCategory = useDeleteCategory();
  const [reassignTo, setReassignTo] = useState<number | undefined>(otherCategories[0]?.id);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DeleteCategoryError | null>(null);

  // A fresh dialog target needs its own default destination; refreshing on every `otherCategories`
  // render would stomp a selection the user just made while nothing else about the request changed.
  useEffect(() => {
    setReassignTo(otherCategories[0]?.id);
  }, [category?.id]);

  const needsReassignment = feedCount > 0;
  const canDelete = !needsReassignment || otherCategories.length > 0;

  async function handleConfirm() {
    if (!category || !canDelete) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const response = await deleteCategory(category.id, reassignTo ?? category.id);

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
                    {" "}Its <span className="font-semibold text-secondary">{feedCount} {feedCount === 1 ? "feed" : "feeds"}</span> move to the folder below.
                  </>
                )}
              </p>
            )}
          </div>

          {needsReassignment && (
            otherCategories.length > 0 ? (
              <div className="flex flex-col gap-1.5 px-6 pb-4.5">
                <label htmlFor="reassign-to-category" className="text-sm font-medium text-secondary">Move its feeds to</label>
                <select
                  id="reassign-to-category"
                  className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                  value={reassignTo}
                  onChange={(event) => setReassignTo(Number(event.target.value))}
                >
                  {otherCategories.map((other) => (
                    <option key={other.id} value={other.id}>{other.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="px-6 pb-4.5 text-sm text-error-primary">Create another folder first.</p>
            )
          )}

          {error && <p className="px-6 pb-2 text-sm text-error-primary">{error.message}</p>}

          <div className="flex items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isLoading} isDisabled={!canDelete} onPress={handleConfirm}>
              Delete folder
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
