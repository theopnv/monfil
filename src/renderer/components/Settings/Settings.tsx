import { useEffect, useState } from "react";
import AboutSection from "@/components/Settings/AboutSection";
import AppearanceSection from "@/components/Settings/AppearanceSection";
import DataSection from "@/components/Settings/DataSection";
import ReadingSection from "@/components/Settings/ReadingSection";
import RefreshingSection from "@/components/Settings/RefreshingSection";
import SettingsNav from "@/components/Settings/SettingsNav";

const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "reading", label: "Reading" },
  { id: "refreshing", label: "Refreshing" },
  { id: "data", label: "Your data" },
  { id: "about", label: "About" },
] as const;

export default function Settings() {
  const [version, setVersion] = useState<string | undefined>(undefined);

  useEffect(() => {
    window.electron.ipcRenderer.invoke("app:get-info", undefined)
      .then((info) => setVersion(info.version))
      .catch((error: unknown) => {
        console.error("Error loading the app version:", error);
      });
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <SettingsNav items={SECTIONS} />

      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-secondary px-8.5 py-4.5">
          <div className="mb-1 text-xs font-semibold tracking-wide text-brand-secondary uppercase">
            {version ? `Monfil ${version}` : "Monfil"}
          </div>
          <h1 className="font-display text-display-md leading-none text-primary">Settings</h1>
        </header>

        <div className="mx-auto flex max-w-[640px] flex-col gap-8 px-8.5 py-6.5 pb-20">
          <AppearanceSection />
          <ReadingSection />
          <RefreshingSection />
          <DataSection />
          <AboutSection version={version} />
        </div>
      </div>
    </div>
  );
}
