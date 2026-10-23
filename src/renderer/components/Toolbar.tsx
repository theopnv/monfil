// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from '@/lib/ipc-client';
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Link } from "react-aria-components";
import { Plus, Sliders01 } from "@untitledui/icons";
import { Button } from "./untitled-ui/base/buttons/button";
import { Tooltip } from "./untitled-ui/base/tooltip/tooltip";
import { cx } from "./untitled-ui/utils/cx";
import Hint from "@/components/common/Hint";
import MonfilLogo from "@/components/common/MonfilLogo";
import DeleteWorkspaceDialog from "@/components/Workspace/DeleteWorkspaceDialog";
import WorkspaceDialog from "@/components/Workspace/WorkspaceDialog";
import WorkspaceSwitcher from "@/components/Workspace/WorkspaceSwitcher";
import FeedpackInstallDialog from '@/components/Feedpacks/FeedpackInstallDialog';
import {
  useClearDeleteWorkspaceRequest,
  useClearEditWorkspaceRequest,
  useClearExportWorkspaceRequest,
  useDeleteWorkspaceRequestedId,
  useEditWorkspaceRequestedId,
  useExportWorkspaceRequestedId,
} from "@/lib/ipc-bridge";
import { hasOnlyModKey, MOD_KEY_LABEL } from "@/lib/keyboard";
import { workspaceIconComponent } from "@/lib/workspace-icons";
import { useHint } from "@/providers/hints-provider";
import { useExportOpml } from "@/providers/opml-provider";
import { useActiveWorkspaceId, useWorkspaces } from "@/providers/workspace-provider";
import { HOME_WORKSPACE_ID, type WorkspaceSummary } from "../../shared/contracts";

const activeNavClasses = "rounded-xl bg-brand-secondary *:data-icon:text-fg-brand-secondary hover:bg-brand-secondary hover:*:data-icon:text-fg-brand-secondary";

function WorkspaceButton({ workspace, isActive, shortcut }: { workspace: WorkspaceSummary; isActive: boolean; shortcut: string | undefined }) {
  const Icon = workspaceIconComponent(workspace.icon);
  const title = shortcut ? <>{workspace.name} <kbd className="ml-1 font-sans font-normal opacity-70">{shortcut}</kbd></> : workspace.name;

  return (
    <Tooltip title={title} placement="right" delay={200}>
      <Link
        href={`/workspace/${workspace.id}`}
        aria-label={workspace.name}
        onContextMenu={(event) => {
          event.preventDefault();
          ipc.send('workspaces:show-context-menu', workspace.id);
        }}
        className={cx(
          "group relative flex size-9 flex-none items-center justify-center rounded-xl outline-brand transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2",
          isActive && "ring-2 ring-inset ring-brand",
        )}
        style={{ backgroundColor: `color-mix(in srgb, ${workspace.color} 18%, transparent)`, color: workspace.color }}
      >
        <Icon aria-hidden className="size-4.5 stroke-[2.25px]" />
      </Link>
    </Tooltip>
  );
}

function workspaceShortcutIndex(event: KeyboardEvent): number | null {
  if (!hasOnlyModKey(event) || !/^[1-9]$/.test(event.key)) {
    return null;
  }
  return Number(event.key) - 1;
}

function useWorkspaceShortcuts(workspaces: WorkspaceSummary[], goTo: (workspaceId: number) => void, openSwitcher: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (hasOnlyModKey(event) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSwitcher();
        return;
      }
      const index = workspaceShortcutIndex(event);
      const workspace = index === null ? undefined : workspaces[index];
      if (workspace) {
        event.preventDefault();
        goTo(workspace.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaces, goTo, openSwitcher]);
}

export default function Toolbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFeedpackBrowserOpen, setIsFeedpackBrowserOpen] = useState(false);
  const [feedpackDraft, setFeedpackDraft] = useState<{ name: string; icon: string; color: string }>();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspacePendingDelete, setWorkspacePendingDelete] = useState<WorkspaceSummary | null>(null);

  const editWorkspaceRequestedId = useEditWorkspaceRequestedId();
  const clearEditWorkspaceRequest = useClearEditWorkspaceRequest();
  const exportWorkspaceRequestedId = useExportWorkspaceRequestedId();
  const clearExportWorkspaceRequest = useClearExportWorkspaceRequest();
  const deleteWorkspaceRequestedId = useDeleteWorkspaceRequestedId();
  const clearDeleteWorkspaceRequest = useClearDeleteWorkspaceRequest();
  const exportOpml = useExportOpml();
  const newWorkspaceAnchorRef = useRef<HTMLDivElement>(null);
  const workspaceHint = useHint('workspace', { ready: true });

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

  const goToWorkspace = useCallback((workspaceId: number) => {
    void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(workspaceId) } });
  }, [navigate]);
  const openSwitcher = useCallback(() => setIsSwitcherOpen(true), []);
  useWorkspaceShortcuts(workspaces, goToWorkspace, openSwitcher);

  function handleWorkspaceDeleted(workspaceId: number) {
    if (activeWorkspaceId === workspaceId) {
      void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(HOME_WORKSPACE_ID) } });
    }
  }

  function openFeedpackBrowser(draft: { name: string; icon: string; color: string }) {
    setFeedpackDraft(draft);
    setIsCreateOpen(false);
    setIsFeedpackBrowserOpen(true);
  }

  return (
    <nav className="flex h-full w-16 flex-none flex-col items-center gap-1.5 border-r border-secondary bg-secondary py-4.5">
      <div className="flex flex-col items-center gap-3.5">
        <MonfilLogo className="size-8.5" />

        {workspaces.map((workspace, index) => (
          <WorkspaceButton
            key={workspace.id}
            workspace={workspace}
            shortcut={index < 9 ? `${MOD_KEY_LABEL}${index + 1}` : undefined}
            isActive={pathname === `/workspace/${workspace.id}` || pathname.startsWith(`/workspace/${workspace.id}/`)}
          />
        ))}
      </div>

      <div ref={newWorkspaceAnchorRef} className="flex">
        <Button aria-label="New workspace" size="md" color="tertiary" className="rounded-xl" iconLeading={<Plus />} onPress={() => {
          setIsCreateOpen(true);
        }} />
      </div>
      <Hint triggerRef={newWorkspaceAnchorRef} isOpen={workspaceHint.isOpen} onDismiss={workspaceHint.dismiss} placement="right">
        Create a workspace to group feeds. Right-click a workspace to edit or delete it.
      </Hint>

      <div className="mt-auto" />

      <Button
        href="/settings"
        aria-label="Settings"
        size="md"
        color="tertiary"
        className={pathname === "/settings" ? activeNavClasses : "rounded-xl"}
        iconLeading={<Sliders01 />}
      />

      <WorkspaceSwitcher isOpen={isSwitcherOpen} onOpenChange={setIsSwitcherOpen} workspaces={workspaces} onSelect={goToWorkspace} />
      <WorkspaceDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} onBrowseFeedpacks={openFeedpackBrowser} />
      <FeedpackInstallDialog isOpen={isFeedpackBrowserOpen} onOpenChange={setIsFeedpackBrowserOpen} newWorkspaceDraft={feedpackDraft} />
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
