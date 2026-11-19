// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { translateErrorWithDetails } from "@/lib/error-text";
import { useFormatLocale } from "@/lib/i18n";
import { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { ipc, rendererLogger } from '@/lib/ipc-client';
import { appInfoQuery } from '@/lib/queries';
import { Folder, UploadCloud01 } from "@untitledui/icons";
import ImportOpmlDialog from "@/components/Workspace/ImportOpmlDialog";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Button } from "@/components/untitled-ui/base/buttons/button";

function formatBytes(bytes: number, locale: string): string {
  const number = new Intl.NumberFormat(locale);
  if (bytes < 1024) {
    return `${number.format(bytes)} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

export default function DataSection() {
  const { t } = useTranslation('settings');
  const { t: tErrors } = useTranslation('errors');
  const locale = useFormatLocale();
  const { data: info } = useQuery(appInfoQuery());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | undefined>();

  return (
    <SettingsSection id="data" title={t('section.data')}>
      <div className="flex items-center gap-8 rounded-xl border border-secondary bg-primary p-5">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{info ? new Intl.NumberFormat(locale).format(info.feedCount) : "—"}</span>
          <span className="text-sm text-tertiary">{t('data.feeds')}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{info ? new Intl.NumberFormat(locale).format(info.itemCount) : "—"}</span>
          <span className="text-sm text-tertiary">{t('data.articles')}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{info ? formatBytes(info.databaseSizeBytes, locale) : "—"}</span>
          <span className="text-sm text-tertiary">{t('data.size')}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Button color="secondary" className="self-start" onPress={() => {
          void ipc.invoke('app:back-up-database', undefined).then((result) => {
            if (result.success) {
              setBackupMessage(t('data.backedUp'));
            } else if (result.error.name !== 'CANCELLED') {
              setBackupMessage(t('data.backupFailed', { message: translateErrorWithDetails(tErrors, result.error) }));
            }
          }).catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Database backup failed:' }, error));
        }}>{t('data.backUp')}</Button>
        <Button
          color="secondary"
          iconLeading={Folder}
          className="self-start"
          onPress={() => ipc.send("app:reveal-database-file", undefined)}
        >
          {t('data.reveal')}
        </Button>
        <Button color="secondary" iconLeading={UploadCloud01} className="self-start" onPress={() => setIsImportOpen(true)}>
          {t('data.importOpml')}
        </Button>
      </div>
      {backupMessage && <p role="status" className="text-sm text-secondary">{backupMessage}</p>}

      <ImportOpmlDialog isOpen={isImportOpen} onOpenChange={setIsImportOpen} />
    </SettingsSection>
  );
}
