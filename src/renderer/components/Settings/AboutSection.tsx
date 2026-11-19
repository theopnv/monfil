// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { LinkExternal01 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { openLink } from "@/lib/river/utils";
import SettingsSection from "@/components/Settings/SettingsSection";
import MonfilLogo from "@/components/common/MonfilLogo";

const LINKS = [
  { key: "website", url: "https://monfil.app" },
  { key: "documentation", url: "https://monfil.app/docs/" },
  { key: "changelog", url: "https://monfil.app/docs/changelog/" },
  { key: "reportIssue", url: "https://github.com/theopnv/monfil/issues" },
  { key: "buyCoffee", url: "https://buymeacoffee.com/theopnv" },
] as const;

export interface AboutSectionProps {
  version: string | undefined;
}

export default function AboutSection({ version }: AboutSectionProps) {
  const { t } = useTranslation('settings');
  return (
    <SettingsSection id="about" title={t('section.about')}>
      <div className="flex items-center gap-4">
        <MonfilLogo className="size-11.5 flex-none" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-primary">Monfil{version ? ` ${version}` : ""}</span>
          <span className="text-sm text-tertiary">{t('about.tagline')}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {LINKS.map(({ key, url }) => (
          <Button key={url} color="link-color" size="sm" iconTrailing={LinkExternal01} onPress={() => openLink(url)}>
            {t(`about.link.${key}`)}
          </Button>
        ))}
      </div>
    </SettingsSection>
  );
}
