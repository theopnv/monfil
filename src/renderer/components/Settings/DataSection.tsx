import { useEffect, useState } from "react";
import { ipc, rendererLogger } from '@/lib/ipc-client';
import { Folder, UploadCloud01 } from "@untitledui/icons";
import ImportOpmlDialog from "@/components/Workspace/ImportOpmlDialog";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import type { AppInfo } from "../../../shared/contracts";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function DataSection() {
  const [info, setInfo] = useState<AppInfo | undefined>(undefined);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | undefined>();

  useEffect(() => {
    const load = () => {
      ipc.invoke("app:get-info", undefined)
        .then(setInfo)
        .catch((error: unknown) => {
          rendererLogger.error('renderer.failure', { message: 'Error loading app info:' }, error);
        });
    };
    load();
    return ipc.on("feeds:refreshed", load);
  }, []);

  return (
    <SettingsSection id="data" title="Your data">
      <div className="flex items-center gap-8 rounded-xl border border-secondary bg-primary p-5">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{info?.feedCount ?? "—"}</span>
          <span className="text-sm text-tertiary">Feeds</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{info?.itemCount ?? "—"}</span>
          <span className="text-sm text-tertiary">Articles</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{info ? formatBytes(info.databaseSizeBytes) : "—"}</span>
          <span className="text-sm text-tertiary">Database size</span>
        </div>
      </div>

      <div className="flex gap-2.5">
        <Button color="secondary" className="self-start" onPress={() => {
          void ipc.invoke('app:back-up-database', undefined).then((result) => {
            if (result.success) {
              setBackupMessage('Database backup saved.');
            } else if (result.error.name !== 'CANCELLED') {
              setBackupMessage(`Backup failed: ${result.error.message}`);
            }
          }).catch((error: unknown) => rendererLogger.error('renderer.failure', { message: 'Database backup failed:' }, error));
        }}>Back up database…</Button>
        <Button
          color="secondary"
          iconLeading={Folder}
          className="self-start"
          onPress={() => ipc.send("app:reveal-database-file", undefined)}
        >
          Reveal database file
        </Button>
        <Button color="secondary" iconLeading={UploadCloud01} className="self-start" onPress={() => setIsImportOpen(true)}>
          Import OPML
        </Button>
      </div>
      {backupMessage && <p role="status" className="text-sm text-secondary">{backupMessage}</p>}

      <ImportOpmlDialog isOpen={isImportOpen} onOpenChange={setIsImportOpen} />
    </SettingsSection>
  );
}
