import SegmentedControl from "@/components/common/SegmentedControl";
import SettingsRow from "@/components/Settings/SettingsRow";
import SettingsSection from "@/components/Settings/SettingsSection";
import { DENSITIES } from "@/lib/river/utils";
import { usePreferences } from "@/providers/preferences-provider";
import { useTheme } from "@/providers/theme-provider";

const THEMES = ["light", "dark", "system"] as const;

const THEME_LABELS: Record<(typeof THEMES)[number], string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const THEME_HINTS: Record<(typeof THEMES)[number], string> = {
  light: "Always use the light appearance.",
  dark: "Always use the dark appearance.",
  system: "Match your OS setting, and switch automatically when it changes.",
};

export default function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsSection id="appearance" title="Appearance">
      <SettingsRow label="Theme" hint={THEME_HINTS[theme]}>
        <SegmentedControl options={THEMES} value={theme} onChange={setTheme} getLabel={(option) => THEME_LABELS[option]} />
      </SettingsRow>

      <SettingsRow label="Default density" hint="How river cards are laid out on Home.">
        <SegmentedControl options={DENSITIES} value={preferences.density} onChange={(density) => setPreference("density", density)} />
      </SettingsRow>
    </SettingsSection>
  );
}
