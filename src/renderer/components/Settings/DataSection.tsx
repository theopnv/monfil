import { useEffect, useState } from "react";
import { Folder } from "@untitledui/icons";
import SettingsSection from "@/components/Settings/SettingsSection";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import type { AppInfo } from "../../../main/app-info";

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

  useEffect(() => {
    const load = () => {
      window.electron.ipcRenderer.invoke("app:get-info", undefined)
        .then(setInfo)
        .catch((error: unknown) => {
          console.error("Error loading app info:", error);
        });
    };
    load();
    return window.electron.ipcRenderer.on("feeds:list", load);
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

      <Button
        color="secondary"
        iconLeading={Folder}
        className="self-start"
        onPress={() => window.electron.ipcRenderer.sendMessage("app:reveal-database-file", undefined)}
      >
        Reveal database file
      </Button>
    </SettingsSection>
  );
}
