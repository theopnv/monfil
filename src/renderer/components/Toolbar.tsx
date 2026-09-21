import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Link } from "react-aria-components";
import { Plus, Sliders01 } from "@untitledui/icons";
import { Button } from "./untitled-ui/base/buttons/button";
import { cx } from "./untitled-ui/utils/cx";
import MonfilLogo from "@/components/common/MonfilLogo";
import DeleteWorkspaceDialog from "@/components/Workspace/DeleteWorkspaceDialog";
import WorkspaceDialog from "@/components/Workspace/WorkspaceDialog";
import FeedpackInstallDialog from '@/components/Feedpacks/FeedpackInstallDialog';
import {
  useClearDeleteWorkspaceRequest,
  useClearEditWorkspaceRequest,
  useClearExportWorkspaceRequest,
  useDeleteWorkspaceRequestedId,
  useEditWorkspaceRequestedId,
  useExportWorkspaceRequestedId,
} from "@/lib/ipc-bridge";
import { workspaceIconComponent } from "@/lib/workspace-icons";
import { useExportOpml } from "@/providers/opml-provider";
import { useActiveWorkspaceId, useWorkspaces } from "@/providers/workspace-provider";
import { HOME_WORKSPACE_ID, type WorkspaceSummary } from "../../shared/contracts";

const activeNavClasses = "rounded-xl bg-brand-secondary *:data-icon:text-fg-brand-secondary hover:bg-brand-secondary hover:*:data-icon:text-fg-brand-secondary";

function WorkspaceButton({ workspace, isActive }: { workspace: WorkspaceSummary; isActive: boolean }) {
  const Icon = workspaceIconComponent(workspace.icon);

  return (
    <Link
      href={`/workspace/${workspace.id}`}
      aria-label={workspace.name}
      onContextMenu={(event) => {
        event.preventDefault();
        window.electron.ipcRenderer.sendMessage('workspaces:show-context-menu', workspace.id);
      }}
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
  const navigate = useNavigate();
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFeedpackBrowserOpen, setIsFeedpackBrowserOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspacePendingDelete, setWorkspacePendingDelete] = useState<WorkspaceSummary | null>(null);

  const editWorkspaceRequestedId = useEditWorkspaceRequestedId();
  const clearEditWorkspaceRequest = useClearEditWorkspaceRequest();
  const exportWorkspaceRequestedId = useExportWorkspaceRequestedId();
  const clearExportWorkspaceRequest = useClearExportWorkspaceRequest();
  const deleteWorkspaceRequestedId = useDeleteWorkspaceRequestedId();
  const clearDeleteWorkspaceRequest = useClearDeleteWorkspaceRequest();
  const exportOpml = useExportOpml();

  useEffect(() => {
    if (editWorkspaceRequestedId === null) {
      return;
    }
    const workspace = workspaces.find((candidate) => candidate.id === editWorkspaceRequestedId);
    if (workspace) {
      setEditingWorkspace(workspace);
    }
    clearEditWorkspaceRequest();
  }, [editWorkspaceRequestedId, workspaces, clearEditWorkspaceRequest]);

  useEffect(() => {
    if (exportWorkspaceRequestedId === null) {
      return;
    }
    void exportOpml(exportWorkspaceRequestedId);
    clearExportWorkspaceRequest();
  }, [exportWorkspaceRequestedId, exportOpml, clearExportWorkspaceRequest]);

  useEffect(() => {
    if (deleteWorkspaceRequestedId === null) {
      return;
    }
    const workspace = workspaces.find((candidate) => candidate.id === deleteWorkspaceRequestedId);
    if (workspace) {
      setWorkspacePendingDelete(workspace);
    }
    clearDeleteWorkspaceRequest();
  }, [deleteWorkspaceRequestedId, workspaces, clearDeleteWorkspaceRequest]);

  function handleWorkspaceDeleted(workspaceId: number) {
    if (activeWorkspaceId === workspaceId) {
      void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(HOME_WORKSPACE_ID) } });
    }
  }

  function openFeedpackBrowser() {
    setIsCreateOpen(false);
    setIsFeedpackBrowserOpen(true);
  }

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

      <Button aria-label="New workspace" size="md" color="tertiary" className="rounded-xl" iconLeading={<Plus />} onPress={() => {
        setIsCreateOpen(true);
      }} />

      <div className="mt-auto" />

      <Button
        href="/settings"
        aria-label="Settings"
        size="md"
        color="tertiary"
        className={pathname === "/settings" ? activeNavClasses : "rounded-xl"}
        iconLeading={<Sliders01 />}
      />

      <WorkspaceDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} onBrowseFeedpacks={openFeedpackBrowser} />
      <FeedpackInstallDialog isOpen={isFeedpackBrowserOpen} onOpenChange={setIsFeedpackBrowserOpen} />
      <WorkspaceDialog
        isOpen={editingWorkspace !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingWorkspace(null);
          }
        }}
        {...(editingWorkspace ? { workspace: editingWorkspace } : {})}
      />
      <DeleteWorkspaceDialog
        workspace={workspacePendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setWorkspacePendingDelete(null);
          }
        }}
        onDeleted={handleWorkspaceDeleted}
      />
    </nav>
  );
}
