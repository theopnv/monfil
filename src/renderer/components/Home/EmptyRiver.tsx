// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { Rss01 } from "@untitledui/icons";
import AddFeedModal from "@/components/AddFeed/AddFeedModal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useActiveWorkspaceId } from "@/providers/workspace-provider";
import { HOME_WORKSPACE_ID } from "../../../shared/contracts";

export interface EmptyRiverProps {
  /**
   * Opens the OPML import dialog. Rendered by the caller rather than here: the dialog's own
   * "Import complete" summary must outlive this component, which unmounts the moment the import
   * succeeds and the workspace stops being empty.
   */
  onImportOpml: () => void;
  onImportFeedpack: () => void;
}

export default function EmptyRiver({ onImportOpml, onImportFeedpack }: EmptyRiverProps) {
  const { t } = useTranslation('river');
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const isHome = useActiveWorkspaceId() === HOME_WORKSPACE_ID;

  return (
    <div className="flex flex-col items-center px-7.5 py-20 text-center">
      <span className="mb-4.5 flex size-16.5 items-center justify-center rounded-full bg-brand-secondary text-brand-secondary">
        <Rss01 className="size-7.5 stroke-[2.75px]" />
      </span>
      {isHome ? (
        <>
          <h2 className="mb-1.75 text-lg leading-tight font-bold text-primary">{t('empty.homeTitle')}</h2>
          <p className="mb-5.5 max-w-[44ch] text-sm leading-relaxed text-tertiary text-pretty">
            {t('empty.homeBody')}
          </p>
          <Button color="primary" className="rounded-full" onPress={() => setIsAddFeedOpen(true)}>
            {t('empty.addFirst')}
          </Button>
          <AddFeedModal isOpen={isAddFeedOpen} onOpenChange={setIsAddFeedOpen} />
        </>
      ) : (
        <>
          <h2 className="mb-1.75 text-lg leading-tight font-bold text-primary">{t('empty.otherTitle')}</h2>
          <p className="mb-5.5 max-w-[44ch] text-sm leading-relaxed text-tertiary text-pretty">
            {t('empty.otherBody')}
          </p>
          <div className="flex gap-2.5">
            <Button color="primary" className="rounded-full" onPress={onImportOpml}>{t('empty.importOpml')}</Button>
            <Button color="secondary" className="rounded-full" onPress={onImportFeedpack}>{t('empty.importFeedpack')}</Button>
          </div>
        </>
      )}
    </div>
  );
}
