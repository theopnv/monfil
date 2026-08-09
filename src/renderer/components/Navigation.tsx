import { HomeLine, Settings01 } from "@untitledui/icons";
import type { NavItemType } from "@/components/untitled-ui/application/app-navigation/config";
import { MAIN_SIDEBAR_WIDTH, SidebarNavigationDualTier } from "@/components/untitled-ui/application/app-navigation/sidebar-navigation/sidebar-dual-tier";

export { MAIN_SIDEBAR_WIDTH };

const navItemsDualTier: (NavItemType)[] = [
    {
        label: "Home",
        href: "/",
        icon: HomeLine
    }
];

export const SidebarSectionDualTier = () => <SidebarNavigationDualTier
  activeUrl="/"
  logo={<span className="text-lg font-bold text-brand-secondary">Monfil</span>}
  items={navItemsDualTier}
  footerItems={[
    {
        label: "Settings",
        href: "/settings",
        icon: Settings01,
    },
  ]} />;
