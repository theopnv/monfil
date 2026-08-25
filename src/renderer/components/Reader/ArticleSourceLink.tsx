import { LinkExternal01 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { openLink } from "@/lib/river/utils";
import type { RiverItem } from "@/lib/river/utils";

export interface ArticleSourceLinkProps {
  item: RiverItem;
}

export default function ArticleSourceLink({ item }: ArticleSourceLinkProps) {
  if (!item.link) {
    return null;
  }

  return (
    <div className="mb-8.5 flex items-center border-t border-secondary pt-6">
      <Button color="link-color" size="sm" iconTrailing={LinkExternal01} className="ml-auto" onPress={() => openLink(item.link)}>
        Read on {item.feedTitle}
      </Button>
    </div>
  );
}
