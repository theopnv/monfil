import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Link } from "react-aria-components";
import { Plus, Sliders01 } from "@untitledui/icons";
import { Button } from "./untitled-ui/base/buttons/button";
import { cx } from "./untitled-ui/utils/cx";
import MonfilLogo from "@/components/common/MonfilLogo";
import WorkspaceDialog from "@/components/Workspace/WorkspaceDialog";
import { workspaceIconComponent } from "@/lib/workspace-icons";
import { useWorkspaces } from "@/providers/workspace-provider";
import type { WorkspaceSummary } from "../../preload/channels";

const activeNavClasses = "rounded-xl bg-brand-secondary *:data-icon:text-fg-brand-secondary hover:bg-brand-secondary hover:*:data-icon:text-fg-brand-secondary";

function WorkspaceButton({ workspace, isActive }: { workspace: WorkspaceSummary; isActive: boolean }) {
  const Icon = workspaceIconComponent(workspace.icon);

  return (
    <Link
      href={`/workspace/${workspace.id}`}
      aria-label={workspace.name}
      className={cx(
        "group relative flex size-9 flex-none items-center justify-center rounded-xl outline-brand transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2",
        isActive && "ring-2 ring-inset ring-brand",
      )}
      style={{ backgroundColor: `color-mix(in srgb, ${workspace.color} 18%, transparent)`, color: workspace.color }}
    >
      <Icon aria-hidden className="size-4.5 stroke-[2.25px]" />
      {workspace.hasUnread && (
        <span data-testid="unread-dot" aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand-solid ring-2 ring-secondary" />
      )}
    </Link>
  );
}

export default function Toolbar() {
  const { pathname } = useLocation();
  const workspaces = useWorkspaces();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <nav className="flex h-full w-16 flex-none flex-col items-center gap-1.5 border-r border-secondary bg-secondary py-4.5">
      <div className="flex flex-col items-center gap-3.5">
        <MonfilLogo className="size-8.5" />

        {workspaces.map((workspace) => (
          <WorkspaceButton
            key={workspace.id}
            workspace={workspace}
            isActive={pathname === `/workspace/${workspace.id}` || pathname.startsWith(`/workspace/${workspace.id}/`)}
          />
        ))}
      </div>

      <Button aria-label="New workspace" size="md" color="tertiary" className="rounded-xl" iconLeading={<Plus />} onPress={() => setIsCreateOpen(true)} />

      <div className="mt-auto" />

      <Button
        href="/settings"
        aria-label="Settings"
        size="md"
        color="tertiary"
        className={pathname === "/settings" ? activeNavClasses : "rounded-xl"}
        iconLeading={<Sliders01 />}
      />

      <WorkspaceDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </nav>
  );
}
