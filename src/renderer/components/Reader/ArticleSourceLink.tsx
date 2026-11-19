// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { LinkExternal01 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { openLink } from "@/lib/river/utils";
import type { RiverRow } from "../../../shared/contracts";

export interface ArticleSourceLinkProps {
  item: RiverRow;
}

export default function ArticleSourceLink({ item }: ArticleSourceLinkProps) {
  const { t } = useTranslation('reader');
  if (!item.link) {
    return null;
  }

  return (
    <Button color="link-color" size="sm" iconTrailing={LinkExternal01} onPress={() => openLink(item.link)}>
      {t('sourceLink', { source: item.feedTitle })}
    </Button>
  );
}
