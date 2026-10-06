// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useQuery } from '@tanstack/react-query';
import { appInfoQuery } from '@/lib/queries';
import DiagnosticsSection from '@/components/Settings/DiagnosticsSection';
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
  { id: "diagnostics", label: "Diagnostics" },
  { id: "about", label: "About" },
] as const;

export default function Settings() {
  const { data: info } = useQuery(appInfoQuery());
  const version = info?.version;

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
          <DiagnosticsSection />
          <AboutSection version={version} />
        </div>
      </div>
    </div>
  );
}
