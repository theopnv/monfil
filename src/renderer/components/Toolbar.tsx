import { useLocation } from "@tanstack/react-router";
import { Button } from "./untitled-ui/base/buttons/button";
import { Home02, Sliders01 } from "@untitledui/icons";
import MonfilLogo from "@/components/common/MonfilLogo";

const activeNavClasses = "rounded-xl bg-brand-secondary *:data-icon:text-fg-brand-secondary hover:bg-brand-secondary hover:*:data-icon:text-fg-brand-secondary";

export default function Toolbar() {
  const { pathname } = useLocation();

  return (
    <nav className="flex h-full w-16 flex-none flex-col items-center gap-1.5 border-r border-secondary bg-secondary py-4.5">
      <MonfilLogo className="mb-3.5 size-8.5" />

      <Button
        href="/"
        aria-label="Home"
        size="md"
        color="tertiary"
        className={pathname === "/" ? activeNavClasses : "rounded-xl"}
        iconLeading={<Home02 />}
      />

      <div className="mt-auto" />

      <Button
        href="/settings"
        aria-label="Settings"
        size="md"
        color="tertiary"
        className={pathname === "/settings" ? activeNavClasses : "rounded-xl"}
        iconLeading={<Sliders01 />}
      />
    </nav>
  );
}
