import SettingsSection from "@/components/Settings/SettingsSection";
import MonfilLogo from "@/components/common/MonfilLogo";

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
    </SettingsSection>
  );
}
