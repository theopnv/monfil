import { useState } from "react";
import { Rss01 } from "@untitledui/icons";
import AddFeedModal from "@/components/AddFeed/AddFeedModal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useActiveWorkspaceId } from "@/providers/workspace-provider";
import { HOME_WORKSPACE_ID } from "../../../preload/channels";

export default function EmptyRiver() {
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
          <p className="max-w-[44ch] text-sm leading-relaxed text-tertiary text-pretty">
            This workspace has no sources yet. Pack install and OPML import are on their way.
          </p>
        </>
      )}
    </div>
  );
}
