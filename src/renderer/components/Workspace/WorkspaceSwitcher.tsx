// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Autocomplete, Input, ListBox, ListBoxItem, SearchField, useFilter } from "react-aria-components";
import { SearchLg } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { cx } from "@/components/untitled-ui/utils/cx";
import { MOD_KEY_LABEL } from "@/lib/keyboard";
import { workspaceIconComponent } from "@/lib/workspace-icons";
import type { WorkspaceSummary } from "../../../shared/contracts";

export interface WorkspaceSwitcherProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workspaces: WorkspaceSummary[];
  onSelect: (workspaceId: number) => void;
}

export default function WorkspaceSwitcher({ isOpen, onOpenChange, workspaces, onSelect }: WorkspaceSwitcherProps) {
  const { contains } = useFilter({ sensitivity: 'base' });
  const shortcuts = new Map(workspaces.slice(0, 9).map((workspace, index) => [workspace.id, `${MOD_KEY_LABEL}${index + 1}`]));

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="sm:items-start sm:pt-[15vh]">
      <Modal className="w-full max-w-md">
        <Dialog aria-label="Switch workspace">
          <Autocomplete filter={contains}>
            <SearchField aria-label="Workspace name" autoFocus className="flex items-center gap-2 border-b border-secondary px-4 py-3">
              <SearchLg aria-hidden className="size-4 text-fg-quaternary" />
              <Input placeholder="Go to workspace…" className="min-w-0 flex-1 bg-transparent text-md text-primary outline-none placeholder:text-placeholder" />
            </SearchField>
            <ListBox
              aria-label="Workspaces"
              items={workspaces}
              onAction={(key) => {
                onSelect(Number(key));
                onOpenChange(false);
              }}
              renderEmptyState={() => <p className="px-4 py-3 text-sm text-tertiary">No workspace matches.</p>}
              className="max-h-80 overflow-y-auto p-1.5 outline-none"
            >
              {(workspace) => {
                const Icon = workspaceIconComponent(workspace.icon);
                return (
                  <ListBoxItem
                    id={workspace.id}
                    textValue={workspace.name}
                    className={({ isFocused }) => cx("flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-primary outline-none", isFocused && "bg-primary_hover")}
                  >
                    <span className="flex size-6 flex-none items-center justify-center rounded-md" style={{ backgroundColor: `color-mix(in srgb, ${workspace.color} 18%, transparent)`, color: workspace.color }}>
                      <Icon aria-hidden className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    {shortcuts.has(workspace.id) && <kbd className="font-sans text-xs text-tertiary">{shortcuts.get(workspace.id)}</kbd>}
                  </ListBoxItem>
                );
              }}
            </ListBox>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
