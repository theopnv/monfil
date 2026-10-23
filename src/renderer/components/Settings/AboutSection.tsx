// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { LinkExternal01 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { openLink } from "@/lib/river/utils";
import SettingsSection from "@/components/Settings/SettingsSection";
import MonfilLogo from "@/components/common/MonfilLogo";

const LINKS = [
  { label: "Changelog", url: "https://theopnv.github.io/monfil/changelog/" },
  { label: "Report an issue", url: "https://github.com/theopnv/monfil/issues" },
  { label: "Buy me a coffee", url: "https://buymeacoffee.com/theopnv" },
];

export interface AboutSectionProps {
  version: string | undefined;
}

export default function AboutSection({ version }: AboutSectionProps) {
  return (
    <SettingsSection id="about" title="About">
      <div className="flex items-center gap-4">
        <MonfilLogo className="size-11.5 flex-none" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-primary">Monfil{version ? ` ${version}` : ""}</span>
          <span className="text-sm text-tertiary">RSS feed reader and more.</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {LINKS.map(({ label, url }) => (
          <Button key={url} color="link-color" size="sm" iconTrailing={LinkExternal01} onPress={() => openLink(url)}>
            {label}
          </Button>
        ))}
      </div>
    </SettingsSection>
  );
}
