import SettingsSection from "@/components/Settings/SettingsSection";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import { usePreferences } from "@/providers/preferences-provider";

export default function ReadingSection() {
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsSection id="reading" title="Reading">
      <Toggle
        className="w-full"
        label="Mark as read while scrolling"
        hint="An item is marked read once it scrolls above the top of the list."
        isSelected={preferences.markReadOnScroll}
        onChange={(isSelected) => setPreference("markReadOnScroll", isSelected)}
      />
      <Toggle
        className="w-full"
        label="Hide read items in Home"
        hint="Read items leave the river instead of staying dimmed."
        isSelected={preferences.hideReadItems}
        onChange={(isSelected) => setPreference("hideReadItems", isSelected)}
      />
      <Toggle
        className="w-full"
        label="Open links in my browser"
        hint="Clicking an item opens its source link instead of the built-in reader."
        isSelected={preferences.openLinksExternally}
        onChange={(isSelected) => setPreference("openLinksExternally", isSelected)}
      />
    </SettingsSection>
  );
}
