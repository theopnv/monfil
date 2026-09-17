import { useState } from "react";
import { Rss01 } from "@untitledui/icons";
import AddFeedModal from "@/components/AddFeed/AddFeedModal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useActiveWorkspaceId } from "@/providers/workspace-provider";
import { HOME_WORKSPACE_ID } from "../../../preload/channels";

export interface EmptyRiverProps {
  /**
   * Opens the OPML import dialog. Rendered by the caller rather than here: the dialog's own
   * "Import complete" summary must outlive this component, which unmounts the moment the import
   * succeeds and the workspace stops being empty.
   */
  onImportOpml: () => void;
}

export default function EmptyRiver({ onImportOpml }: EmptyRiverProps) {
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const isHome = useActiveWorkspaceId() === HOME_WORKSPACE_ID;

  return (
    <div className="flex flex-col items-center px-7.5 py-20 text-center">
      <span className="mb-4.5 flex size-16.5 items-center justify-center rounded-full bg-brand-secondary text-brand-secondary">
        <Rss01 className="size-7.5 stroke-[2.75px]" />
      </span>
      {isHome ? (
        <>
          <h2 className="mb-1.75 text-lg leading-tight font-bold text-primary">Pick your sources</h2>
          <p className="mb-5.5 max-w-[44ch] text-sm leading-relaxed text-tertiary text-pretty">
            Add a blog, a newsletter, anything with a feed. Monfil pulls in what it publishes and never decides what you see.
          </p>
          <Button color="primary" className="rounded-full" onPress={() => setIsAddFeedOpen(true)}>
            Add your first feed
          </Button>
          <AddFeedModal isOpen={isAddFeedOpen} onOpenChange={setIsAddFeedOpen} />
        </>
      ) : (
        <>
          <h2 className="mb-1.75 text-lg leading-tight font-bold text-primary">Nothing here yet</h2>
          <p className="mb-5.5 max-w-[44ch] text-sm leading-relaxed text-tertiary text-pretty">
            This workspace has no sources yet. Import an OPML file to fill it in one go.
          </p>
          <Button color="primary" className="rounded-full" onPress={onImportOpml}>
            Import OPML
          </Button>
        </>
      )}
    </div>
  );
}
