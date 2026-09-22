import { LinkExternal01 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { openLink } from "@/lib/river/utils";
import type { RiverRow } from "../../../shared/contracts";

export interface ArticleSourceLinkProps {
  item: RiverRow;
}

export default function ArticleSourceLink({ item }: ArticleSourceLinkProps) {
  if (!item.link) {
    return null;
  }

  return (
    <Button color="link-color" size="sm" iconTrailing={LinkExternal01} onPress={() => openLink(item.link)}>
      Read on {item.feedTitle}
    </Button>
  );
}
