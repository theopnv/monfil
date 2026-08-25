import { useState } from "react";
import { Heading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useDeleteFeed } from "@/providers/feeds-provider";
import type { DeleteFeedError } from "../../../main/db/delete";
import type { Feed } from "../../../preload/channels";

export interface DeleteFeedDialogProps {
  feed: Feed | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (feed: Feed) => void;
}

export default function DeleteFeedDialog({ feed, onOpenChange, onDeleted }: DeleteFeedDialogProps) {
  const deleteFeed = useDeleteFeed();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DeleteFeedError | null>(null);

  async function handleConfirm() {
    if (!feed) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const response = await deleteFeed(feed.id);

    setIsLoading(false);
    if (response.success) {
      onDeleted(feed);
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
    <ModalOverlay isOpen={feed !== null} onOpenChange={handleOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
            <Heading slot="title" className="font-display text-lg font-semibold text-primary">
              Delete feed
            </Heading>
            {feed && (
              <p className="text-sm text-tertiary">
                This removes <span className="font-semibold text-secondary">{feed.title}</span> and its{" "}
                <span className="font-semibold text-secondary">
                  {feed.items.length} {feed.items.length === 1 ? "item" : "items"}
                </span>
                . There is no undo.
              </p>
            )}
          </div>

          {error && <p className="px-6 pb-2 text-sm text-error-primary">{error.message}</p>}

          <div className="flex items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
            <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button color="primary-destructive" size="md" className="rounded-full" isLoading={isLoading} onPress={handleConfirm}>
              Delete feed
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
