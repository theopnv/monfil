import { cx } from "@/components/untitled-ui/utils/cx";
import { useActiveSection } from "@/components/Settings/useActiveSection";

export interface SettingsNavItem {
  id: string;
  label: string;
}

export interface SettingsNavProps {
  items: readonly SettingsNavItem[];
}

// A plain anchor href would rewrite the router's hash (the app uses hash history, per doc/frontend.md),
// so a section is reached by scrolling it into view instead of navigating to `#<id>`.
export default function SettingsNav({ items }: SettingsNavProps) {
  const activeId = useActiveSection(items.map((item) => item.id));

  return (
    <nav className="flex w-63 flex-none flex-col gap-0.5 border-r border-secondary px-4 py-8">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className={cx(
            "rounded-lg px-3 py-2 text-left text-sm font-medium text-tertiary hover:bg-primary_hover hover:text-secondary",
            activeId === item.id && "bg-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-brand-secondary",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
