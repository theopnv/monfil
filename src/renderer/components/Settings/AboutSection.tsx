import SettingsSection from "@/components/Settings/SettingsSection";
import { Button } from "@/components/untitled-ui/base/buttons/button";

export interface AboutSectionProps {
  version: string | undefined;
}

export default function AboutSection({ version }: AboutSectionProps) {
  return (
    <SettingsSection id="about" title="About">
      <div className="flex items-center gap-4">
        <div className="flex size-11.5 flex-none items-center justify-center rounded-full bg-brand-solid font-display text-lg text-primary_on-brand">
          M
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-primary">Monfil{version ? ` ${version}` : ""}</span>
          <span className="text-sm text-tertiary">RSS feed reader and more.</span>
        </div>
      </div>

      <Button color="secondary" isDisabled className="self-start">
        Check for updates
      </Button>
    </SettingsSection>
  );
}
