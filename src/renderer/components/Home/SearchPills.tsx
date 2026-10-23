// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useRef, useState } from "react";
import { DotsHorizontal, XClose } from "@untitledui/icons";
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { cx } from "@/components/untitled-ui/utils/cx";
import type { SavedSearchSummary } from "../../../shared/contracts";

export interface SearchPillsProps {
  searches: SavedSearchSummary[];
  activeId: number | undefined;
  /** The example to offer in the hint pill, or undefined when the hint must not show. */
  hintExample: string | undefined;
  onToggle: (search: SavedSearchSummary) => void;
  onDelete: (search: SavedSearchSummary) => void;
  onRename: (search: SavedSearchSummary, name: string) => Promise<string | undefined>;
  onUseExample: (example: string) => void;
  onDismissHint: () => void;
}

const pillClasses = "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap outline-brand transition duration-100 ease-linear focus-visible:outline-2";

function RenameField({ search, onRename, onDone }: { search: SavedSearchSummary; onRename: SearchPillsProps["onRename"]; onDone: () => void }) {
  const [name, setName] = useState(search.name);
  const [error, setError] = useState<string>();
  const submitted = useRef(false);

  const submit = async () => {
    if (submitted.current) {
      return;
    }
    submitted.current = true;
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === search.name) {
      onDone();
      return;
    }
    const message = await onRename(search, trimmed);
    if (message) {
      submitted.current = false;
      setError(message);
      return;
    }
    onDone();
  };

  return (
    <form className="flex-none" onSubmit={(event) => {
      event.preventDefault();
      void submit();
    }}>
      <input
        autoFocus
        aria-label={`Rename saved search ${search.name}`}
        aria-invalid={error !== undefined}
        title={error}
        value={name}
        maxLength={60}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void submit()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            submitted.current = true;
            onDone();
          }
        }}
        className={cx("w-36 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary ring-1 ring-inset outline-brand focus-visible:outline-2", error ? "ring-error" : "ring-secondary")}
      />
    </form>
  );
}

function Pill({ search, isActive, onToggle, onDelete, onRename }: { search: SavedSearchSummary; isActive: boolean } & Pick<SearchPillsProps, "onRename"> & { onToggle: () => void; onDelete: () => void }) {
  const [isRenaming, setIsRenaming] = useState(false);

  if (isRenaming) {
    return <RenameField search={search} onRename={onRename} onDone={() => setIsRenaming(false)} />;
  }

  return (
    <div className="group relative flex-none">
      <button
        type="button"
        aria-pressed={isActive}
        aria-label={`${search.name}, ${search.unreadCount} unread`}
        title="Right-click or press F2 to rename"
        onClick={onToggle}
        onContextMenu={(event) => {
          event.preventDefault();
          setIsRenaming(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "F2") {
            setIsRenaming(true);
          } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            onDelete();
          }
        }}
        className={cx(
          pillClasses,
          "pr-3 group-focus-within:pr-7 group-hover:pr-7",
          isActive ? "bg-brand-solid text-white" : "bg-secondary text-secondary ring-1 ring-secondary ring-inset hover:bg-secondary_hover",
        )}
      >
        <span>{search.name}</span>
        <span className={cx("text-xs tabular-nums", isActive ? "text-white" : "text-tertiary")}>{search.unreadCount}</span>
      </button>
      <button
        type="button"
        aria-label={`Delete saved search ${search.name}`}
        onClick={onDelete}
        className={cx(
          "absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full opacity-0 outline-brand transition duration-100 ease-linear group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:outline-2",
          isActive ? "text-white" : "text-fg-quaternary hover:text-fg-quaternary_hover",
        )}
      >
        <XClose className="size-3.5 stroke-[2.5px]" />
      </button>
    </div>
  );
}

function HintPill({ example, onUse, onDismiss }: { example: string; onUse: () => void; onDismiss: () => void }) {
  return (
    <div className="flex flex-none items-center rounded-full border border-dashed border-primary pr-1">
      <button type="button" onClick={onUse} className="cursor-pointer rounded-full py-1 pr-1.5 pl-3 text-left text-sm text-tertiary outline-brand focus-visible:outline-2">
        Save a search for each role you want, e.g. <code className="font-mono text-secondary">{example}</code>
      </button>
      <button
        type="button"
        aria-label="Dismiss the saved search hint"
        onClick={onDismiss}
        className="flex size-5 cursor-pointer items-center justify-center rounded-full text-fg-quaternary outline-brand hover:text-fg-quaternary_hover focus-visible:outline-2"
      >
        <XClose className="size-3.5 stroke-[2.5px]" />
      </button>
    </div>
  );
}

/** The row of saved searches above the river, with the onboarding hint when no search exists yet. */
export default function SearchPills({ searches, activeId, hintExample, onToggle, onDelete, onRename, onUseExample, onDismissHint }: SearchPillsProps) {
  if (searches.length === 0 && hintExample === undefined) {
    return null;
  }

  return (
    <div className="flex flex-none items-center gap-2 border-b border-secondary px-8.5 py-2.5">
      <div role="toolbar" aria-label="Saved searches" className="mx-auto flex w-full max-w-[860px] min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
          {searches.map((search) => (
            <Pill
              key={search.id}
              search={search}
              isActive={search.id === activeId}
              onToggle={() => onToggle(search)}
              onDelete={() => onDelete(search)}
              onRename={onRename}
            />
          ))}
          {searches.length === 0 && hintExample !== undefined && (
            <HintPill example={hintExample} onUse={() => onUseExample(hintExample)} onDismiss={onDismissHint} />
          )}
        </div>
        {searches.length > 1 && (
          <MenuTrigger>
            <AriaButton
              aria-label="All saved searches"
              className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-full text-fg-quaternary outline-brand hover:bg-secondary focus-visible:outline-2"
            >
              <DotsHorizontal className="size-5" />
            </AriaButton>
            <Popover placement="bottom end" className="z-50 min-w-44 rounded-lg bg-primary p-1 shadow-lg ring-1 ring-secondary">
              <Menu aria-label="Saved searches" className="outline-hidden" onAction={(key) => {
                const search = searches.find((candidate) => candidate.id === Number(key));
                if (search) {
                  onToggle(search);
                }
              }}>
                {searches.map((search) => (
                  <MenuItem
                    key={search.id}
                    id={search.id}
                    textValue={search.name}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-sm text-secondary outline-hidden focus:bg-secondary"
                  >
                    <span className={cx(search.id === activeId && "font-semibold text-brand-secondary")}>{search.name}</span>
                    <span className="text-xs text-tertiary tabular-nums">{search.unreadCount}</span>
                  </MenuItem>
                ))}
              </Menu>
            </Popover>
          </MenuTrigger>
        )}
      </div>
    </div>
  );
}
