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
import { useWorkspaces } from "@/providers/workspace-provider";
import type { ImportOpmlError, ImportOpmlTarget, ImportSummary } from "../../../shared/contracts";
import { dialogHeaderClass, dialogTitleClass, dialogFooterClass } from '@/components/common/dialog-classes';

export interface ImportOpmlDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Omitted: the dialog offers "new workspace" vs "merge into the first workspace", as from Settings. Given: the
   * dialog skips that choice and imports straight into this workspace, as from an empty
   * workspace's own "Import OPML" button.
   */
  workspace?: { id: number; name: string };
}

type Target = 'new-workspace' | 'merge-first';

function MergeOption({ workspace, checked, onSelect }: { workspace: { name: string } | undefined; checked: boolean; onSelect: () => void }) {
  const { t } = useTranslation('workspace');
  if (!workspace) {
    return null;
  }
  return (
    <label className="flex items-center gap-2 text-sm text-secondary">
      <input type="radio" name="opml-target" checked={checked} onChange={onSelect} />
      {t('importOpml.mergeInto', { name: workspace.name })}
    </label>
  );
}

function importTarget(merge: { id: number } | undefined, name: string): ImportOpmlTarget {
  return merge
    ? { kind: 'merge-workspace', workspaceId: merge.id }
    : { kind: 'new-workspace', name: name.trim(), icon: WORKSPACE_ICONS[0], color: WORKSPACE_COLORS[0] };
}

export default function ImportOpmlDialog({ isOpen, onOpenChange, workspace }: ImportOpmlDialogProps) {
  const { t } = useTranslation(['workspace', 'common']);
  const { t: tErrors } = useTranslation('errors');
  const importOpml = useImportOpml();
  const [firstWorkspace] = useWorkspaces();
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

    const result = await importOpml(importTarget(workspace ?? (target === 'merge-first' ? firstWorkspace : undefined), name));

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
              <div className={dialogHeaderClass}>
                <Heading slot="title" className={dialogTitleClass}>
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
              <div className={dialogFooterClass}>
                <Button color="primary" size="md" className="rounded-full" onPress={() => handleOpenChange(false)}>
                  {t('common:action.done')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={dialogHeaderClass}>
                <Heading slot="title" className={dialogTitleClass}>
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
                    <MergeOption workspace={firstWorkspace} checked={target === 'merge-first'} onSelect={() => setTarget('merge-first')} />
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

              <div className={dialogFooterClass}>
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
