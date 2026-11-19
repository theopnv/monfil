// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { ErrorText } from "@/components/errors/ErrorText";
import { translateFeedFailure } from "@/lib/error-text";
import { useState } from "react";
import { Heading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { WORKSPACE_COLORS, WORKSPACE_ICONS } from "@/lib/workspace-icons";
import { useImportOpml } from "@/providers/opml-provider";
import { HOME_WORKSPACE_ID } from "../../../shared/contracts";
import type { ImportOpmlError, ImportSummary } from "../../../shared/contracts";

export interface ImportOpmlDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Omitted: the dialog offers "new workspace" vs "merge into Home", as from Settings. Given: the
   * dialog skips that choice and imports straight into this workspace, as from an empty
   * workspace's own "Import OPML" button.
   */
  workspace?: { id: number; name: string };
}

type Target = 'new-workspace' | 'merge-home';

export default function ImportOpmlDialog({ isOpen, onOpenChange, workspace }: ImportOpmlDialogProps) {
  const { t } = useTranslation(['workspace', 'common']);
  const { t: tErrors } = useTranslation('errors');
  const importOpml = useImportOpml();
  const [target, setTarget] = useState<Target>('new-workspace');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ImportOpmlError | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function reset() {
    setTarget('new-workspace');
    setName('');
    setIsLoading(false);
    setError(null);
    setSummary(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  }

  async function handleImport() {
    setIsLoading(true);
    setError(null);

    const result = await importOpml(
      workspace
        ? { kind: 'merge-workspace', workspaceId: workspace.id }
        : target === 'new-workspace'
          ? { kind: 'new-workspace', name: name.trim(), icon: WORKSPACE_ICONS[0], color: WORKSPACE_COLORS[0] }
          : { kind: 'merge-workspace', workspaceId: HOME_WORKSPACE_ID },
    );

    setIsLoading(false);
    if (result.success) {
      setSummary(result.data);
    } else if (result.error.name !== 'CANCELLED') {
      setError(result.error);
    }
  }

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable>
      <Modal className="w-full max-w-[440px]">
        <Dialog>
          {summary ? (
            <>
              <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
                <Heading slot="title" className="font-display text-lg font-semibold text-primary">
                  {t('workspace:importOpml.doneTitle')}
                </Heading>
                <p className="text-sm text-tertiary">
                  {[
                    t('workspace:importOpml.imported', { count: summary.imported }),
                    ...(summary.skipped.length > 0 ? [t('workspace:importOpml.skipped', { count: summary.skipped.length })] : []),
                    ...(summary.failed.length > 0 ? [t('workspace:importOpml.failed', { count: summary.failed.length })] : []),
                  ].join(' ')}
                </p>
              </div>
              {(summary.skipped.length > 0 || summary.failed.length > 0) && (
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto px-6 pb-4.5 text-sm text-tertiary">
                  {summary.skipped.map((item) => (
                    <li key={`skipped-${item.title}`}>{item.title} — {tErrors(`importSkipped.${item.reason}`)}</li>
                  ))}
                  {summary.failed.map((item) => (
                    <li key={`failed-${item.title}`}>{item.title} — {translateFeedFailure(tErrors, item)}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
                <Button color="primary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
                  {t('common:action.done')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4.5">
                <Heading slot="title" className="font-display text-lg font-semibold text-primary">
                  {workspace ? t('workspace:importOpml.titleInto', { name: workspace.name }) : t('workspace:importOpml.title')}
                </Heading>
                <p className="text-sm text-tertiary">{t('workspace:importOpml.choose')}</p>
              </div>

              {!workspace && (
                <div className="flex flex-col gap-4 px-6 pb-4.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-sm text-secondary">
                      <input type="radio" name="opml-target" checked={target === 'new-workspace'} onChange={() => setTarget('new-workspace')} />
                      {t('workspace:importOpml.newWorkspace')}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-secondary">
                      <input type="radio" name="opml-target" checked={target === 'merge-home'} onChange={() => setTarget('merge-home')} />
                      {t('workspace:importOpml.mergeHome')}
                    </label>
                  </div>

                  {target === 'new-workspace' && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="opml-workspace-name" className="text-sm font-medium text-secondary">{t('workspace:importOpml.name')}</label>
                      <input
                        id="opml-workspace-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t('workspace:importOpml.namePlaceholder')}
                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {error && <ErrorText error={error} className="px-6 pb-2 text-sm text-error-primary" />}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-secondary px-6 py-4">
                <Button color="secondary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
                  {t('common:action.cancel')}
                </Button>
                <Button color="primary" size="md" className="rounded-full" isLoading={isLoading} onPress={handleImport}>
                  {t('common:action.import')}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
