// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from '@/lib/ipc-client';
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button as DragHandleButton, DropIndicator, GridList, GridListItem, Link, useDragAndDrop } from "react-aria-components";
import { LayoutLeft, Plus, Sliders01 } from "@untitledui/icons";
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
} from "@/lib/push-events";
import { decodeFeedDrag, FEED_DRAG_TYPE } from "@/lib/feed-drag";
import { notifyError } from "@/lib/notifications";
import { digitFromCode, hasOnlyModKey, isLetterCode, MOD_KEY_LABEL } from "@/lib/keyboard";
import { reorderIds } from "@/lib/reorder";
import { workspaceIconComponent } from "@/lib/workspace-icons";
import { useHint } from "@/providers/hints-provider";
import { useExportOpml } from "@/providers/opml-provider";
import { useActiveWorkspaceId, useMoveFeedToWorkspace, useReorderWorkspaces, useWorkspaceRailExpanded, useWorkspaces } from "@/providers/workspace-provider";
import type { WorkspaceSummary } from "../../shared/contracts";

const activeNavClasses = "rounded-xl bg-brand-secondary *:data-icon:text-fg-brand-secondary hover:bg-brand-secondary hover:*:data-icon:text-fg-brand-secondary";

type WorkspaceButtonProps = { workspace: WorkspaceSummary; isActive: boolean; shortcut: string | undefined };

function workspaceTint(color: string) {
  return { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color };
}

function showWorkspaceMenu(workspaceId: number) {
  return (event: { preventDefault: () => void }) => {
    event.preventDefault();
    ipc.send('menu:show', { kind: 'workspace', id: workspaceId });
  };
}

function WorkspaceButton({ workspace, isActive, shortcut }: WorkspaceButtonProps) {
  const Icon = workspaceIconComponent(workspace.icon);
  const title = shortcut ? <>{workspace.name} <kbd className="ms-1 font-sans font-normal opacity-70">{shortcut}</kbd></> : workspace.name;

  return (
    <Tooltip title={title} placement="end" delay={200}>
      <Link
        href={`/workspace/${workspace.id}`}
        aria-label={workspace.name}
        {...(isActive && { 'aria-current': 'page' as const })}
        onContextMenu={showWorkspaceMenu(workspace.id)}
        className={cx(
          "group relative flex size-9 flex-none items-center justify-center rounded-xl outline-brand transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2",
          isActive && "ring-2 ring-inset ring-brand",
        )}
        style={workspaceTint(workspace.color)}
      >
        <Icon aria-hidden className="size-4.5 stroke-[2.25px]" />
      </Link>
    </Tooltip>
  );
}

function ExpandedWorkspaceButton({ workspace, isActive, shortcut }: WorkspaceButtonProps) {
  const Icon = workspaceIconComponent(workspace.icon);

  return (
    <Link
      href={`/workspace/${workspace.id}`}
      aria-label={workspace.name}
      {...(isActive && { 'aria-current': 'page' as const })}
      onContextMenu={showWorkspaceMenu(workspace.id)}
      className="group relative flex h-9 w-full items-center gap-2.5 rounded-xl outline-brand transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        className={cx("flex size-9 flex-none items-center justify-center rounded-xl", isActive && "ring-2 ring-inset ring-brand")}
        style={workspaceTint(workspace.color)}
      >
        <Icon aria-hidden className="size-4.5 stroke-[2.25px]" />
      </span>
      <span dir="auto" title={workspace.name} className={cx("min-w-0 flex-1 truncate text-sm text-primary", isActive ? "font-semibold" : "font-medium")}>{workspace.name}</span>
      {shortcut && <kbd className="me-2.5 flex-none font-sans text-xs text-tertiary">{shortcut}</kbd>}
    </Link>
  );
}

// Holding a dragged feed over a workspace this long opens it, so the feed can be dropped into one of its folders.
const FEED_HOVER_OPEN_MS = 1300;

function WorkspaceRail({ workspaces, activeId, goTo, expanded }: { workspaces: WorkspaceSummary[]; activeId: number | undefined; goTo: (workspaceId: number) => void; expanded: boolean }) {
  const { t } = useTranslation('workspace');
  const reorderWorkspaces = useReorderWorkspaces();
  const moveFeedToWorkspace = useMoveFeedToWorkspace();
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelOpen = () => clearTimeout(openTimer.current);
  const { dragAndDropHooks } = useDragAndDrop({
    shouldAcceptItemDrop: (target, types) => types.has(FEED_DRAG_TYPE) && target.key !== activeId,
    getDropOperation: (target, types) => {
      const isOnItem = target.type === 'item' && target.dropPosition === 'on';
      if (types.has(FEED_DRAG_TYPE)) {
        return isOnItem && target.key !== activeId ? 'move' : 'cancel';
      }
      return isOnItem ? 'cancel' : 'move';
    },
    onDropEnter: (event) => {
      cancelOpen();
      if (event.target.type === 'item' && event.target.dropPosition === 'on') {
        const destinationId = Number(event.target.key);
        openTimer.current = setTimeout(() => goTo(destinationId), FEED_HOVER_OPEN_MS);
      }
    },
    onDropExit: cancelOpen,
    onDragEnd: cancelOpen,
    onItemDrop: async (event) => {
      cancelOpen();
      const destinationId = Number(event.target.key);
      for (const dropItem of event.items) {
        const payload = dropItem.kind === 'text' && dropItem.types.has(FEED_DRAG_TYPE) ? decodeFeedDrag(await dropItem.getText(FEED_DRAG_TYPE)) : null;
        if (!payload) {
          continue;
        }
        const result = await moveFeedToWorkspace({ feedId: payload.feedId, fromWorkspaceId: payload.workspaceId, toWorkspaceId: destinationId, categoryName: payload.categoryName });
        if (!result.success) {
          notifyError(t('rail.moveFailed'));
          return;
        }
        goTo(destinationId);
      }
    },
    // Stryker disable next-line ArrowFunction,ObjectLiteral,ArrayDeclaration: the rail only reorders within itself, so nothing reads the drag payload
    getItems: (keys) => [...keys].map((key) => ({ 'text/plain': String(key) })),
    onReorder: (event) => {
      const ids = workspaces.map((workspace) => workspace.id);
      const orderedIds = event.target.dropPosition === 'on' ? ids : reorderIds(ids, event.keys, event.target.key, event.target.dropPosition);
      if (orderedIds.some((id, index) => id !== ids[index])) {
        void reorderWorkspaces(orderedIds);
      }
    },
    renderDropIndicator: (target) => (
      <DropIndicator target={target} className={({ isDropTarget }) => cx("-my-1.75 h-0.5 rounded-full", expanded ? "w-full" : "w-8", isDropTarget && "bg-brand-solid")} />
    ),
  });

  return (
    <GridList
      aria-label={t('rail.list')}
      items={workspaces}
      selectionMode="none"
      onAction={(key) => goTo(Number(key))}
      dragAndDropHooks={dragAndDropHooks}
      dependencies={[activeId, expanded]}
      className={cx("flex flex-col gap-3.5 outline-none", expanded ? "w-full items-stretch" : "items-center")}
    >
      {(workspace) => {
        const index = workspaces.indexOf(workspace);
        const ButtonComponent = expanded ? ExpandedWorkspaceButton : WorkspaceButton;
        return (
          <GridListItem id={workspace.id} textValue={workspace.name} className="rounded-xl outline-brand data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-dragging:opacity-50">
            <DragHandleButton slot="drag" aria-label={t('rail.move', { name: workspace.name })} className="sr-only" />
            <ButtonComponent
              workspace={workspace}
              shortcut={index < 9 ? `${MOD_KEY_LABEL}${index + 1}` : undefined}
              isActive={workspace.id === activeId}
            />
          </GridListItem>
        );
      }}
    </GridList>
  );
}

function workspaceShortcutIndex(event: KeyboardEvent): number | null {
  const digit = digitFromCode(event);
  if (!hasOnlyModKey(event) || digit === null) {
    return null;
  }
  return digit - 1;
}

function useWorkspaceShortcuts(workspaces: WorkspaceSummary[], goTo: (workspaceId: number) => void, openSwitcher: () => void, toggleRail: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (hasOnlyModKey(event) && isLetterCode(event, 'k')) {
        event.preventDefault();
        openSwitcher();
        return;
      }
      if (hasOnlyModKey(event) && isLetterCode(event, 'b')) {
        event.preventDefault();
        toggleRail();
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
  }, [workspaces, goTo, openSwitcher, toggleRail]);
}

function RailToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation('workspace');
  const label = expanded ? t('rail.hideNames') : t('rail.showNames');

  if (expanded) {
    return (
      <Button aria-label={label} aria-expanded size="md" color="tertiary" className="w-full justify-start rounded-xl" iconLeading={<LayoutLeft />} onPress={onToggle}>
        <span className="flex w-full items-center justify-between gap-3">
          {t('rail.collapse')}
          <kbd className="font-sans text-xs font-normal text-tertiary">{MOD_KEY_LABEL}B</kbd>
        </span>
      </Button>
    );
  }

  return (
    <Tooltip title={<>{label} <kbd className="ms-1 font-sans font-normal opacity-70">{MOD_KEY_LABEL}B</kbd></>} placement="end" delay={200}>
      <Button aria-label={label} aria-expanded={false} size="md" color="tertiary" className="rounded-xl" iconLeading={<LayoutLeft />} onPress={onToggle} />
    </Tooltip>
  );
}

export default function Toolbar() {
  const { t } = useTranslation('workspace');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();
  const [railExpanded, setRailExpanded] = useWorkspaceRailExpanded();
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
  const toggleRail = useCallback(() => setRailExpanded(!railExpanded), [setRailExpanded, railExpanded]);
  useWorkspaceShortcuts(workspaces, goToWorkspace, openSwitcher, toggleRail);

  function handleWorkspaceDeleted(workspaceId: number) {
    if (activeWorkspaceId === workspaceId) {
      void navigate({ to: '/' });
    }
  }

  function openFeedpackBrowser(draft: { name: string; icon: string; color: string }) {
    setFeedpackDraft(draft);
    setIsCreateOpen(false);
    setIsFeedpackBrowserOpen(true);
  }

  return (
    <nav className={cx("flex h-full flex-none flex-col gap-1.5 border-e border-secondary bg-secondary py-4.5", railExpanded ? "w-50 items-stretch px-3.5" : "w-16 items-center")}>
      <div className={cx("flex flex-col gap-3.5", railExpanded ? "items-stretch" : "items-center")}>
        <MonfilLogo className={cx("size-8.5", railExpanded && "self-start")} />

        <WorkspaceRail
          workspaces={workspaces}
          goTo={goToWorkspace}
          expanded={railExpanded}
          activeId={workspaces.find(({ id }) => pathname === `/workspace/${id}` || pathname.startsWith(`/workspace/${id}/`))?.id}
        />
      </div>

      <div ref={newWorkspaceAnchorRef} className="flex">
        <Button aria-label={t('rail.new')} size="md" color="tertiary" className={cx("rounded-xl", railExpanded && "w-full justify-start")} iconLeading={<Plus />} onPress={() => {
          setIsCreateOpen(true);
        }}>
          {railExpanded ? t('rail.new') : undefined}
        </Button>
      </div>
      <Hint triggerRef={newWorkspaceAnchorRef} isOpen={workspaceHint.isOpen} onDismiss={workspaceHint.dismiss} placement="end">
        {t('rail.newHint')}
      </Hint>

      <div className="mt-auto" />

      <Tooltip title={t('rail.settings')} placement="end" delay={200} isDisabled={railExpanded}>
        <Button
          href="/settings"
          aria-label={t('rail.settings')}
          size="md"
          color="tertiary"
          className={cx(pathname === "/settings" ? activeNavClasses : "rounded-xl", railExpanded && "w-full justify-start")}
          iconLeading={<Sliders01 />}
        >
          {railExpanded ? t('rail.settings') : undefined}
        </Button>
      </Tooltip>

      <RailToggle expanded={railExpanded} onToggle={toggleRail} />

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
