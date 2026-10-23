// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SearchLg, XClose } from "@untitledui/icons";
import { Input } from "@/components/untitled-ui/base/input/input";
import { SEARCH_SYNTAX } from "@/components/Home/searchSyntax";

const EXPANDED_MAX_WIDTH = 640;
const HEADER_GUTTER = 32;
const BOTTOM_GAP = 14;

// Input's `icon` prop is typed as ComponentType<HTMLAttributes<HTMLOrSVGElement>>,
// but @untitledui/icons components are typed against SVGProps. InputBase only
// ever passes `className`, so this wrapper narrows to what's actually used.
function SearchIcon({ className }: { className?: string | undefined }) {
  return <SearchLg className={className} />;
}

export interface RiverSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Shown in the help panel while the search is open, and beside the box otherwise. */
  saveControl?: ReactNode;
}

interface Placement {
  x: number;
  y: number;
  width: number;
}

/**
 * The search box. It sits in the header's top right corner and, while it has focus, floats to the
 * bottom of the header, centered and wider, with the syntax help below it. Its slot keeps its size
 * so nothing around it moves.
 */
export default function RiverSearch({ value, onChange, placeholder, saveControl }: RiverSearchProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [placement, setPlacement] = useState<Placement>({ x: 0, y: 0, width: 0 });

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const header = slot?.closest("header");
    if (!expanded || !slot || !header) {
      return;
    }
    const slotRect = slot.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const width = Math.min(EXPANDED_MAX_WIDTH, headerRect.width - 2 * HEADER_GUTTER);
    setPlacement({
      x: headerRect.left + headerRect.width / 2 - (slotRect.right - width / 2),
      y: headerRect.bottom - slotRect.bottom - BOTTOM_GAP,
      width,
    });
  }, [expanded]);

  // The scrim takes the click, so closing the search never activates what lies under the pointer.
  const closeFromScrim = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setExpanded(false);
  };

  const handleBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (next && (panelRef.current?.contains(next) || next.closest("[data-search-area]"))) {
      return;
    }
    setExpanded(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      inputRef.current?.blur();
    } else if (event.key === "Escape") {
      if (value === "") {
        inputRef.current?.blur();
      } else {
        onChange("");
      }
    }
  };

  return (
    <>
      <div ref={slotRef} data-search-area className="relative h-10 w-56 flex-none">
        {expanded && <div aria-hidden data-testid="search-scrim" onClick={closeFromScrim} className="fixed inset-0 z-30 animate-in bg-primary/70 backdrop-blur-[2px] duration-200 fade-in" />}
        <div
          ref={panelRef}
          onFocus={() => setExpanded(true)}
          onBlur={handleBlur}
          style={expanded ? { width: placement.width || "100%", transform: `translate(${placement.x}px, ${placement.y}px)` } : { width: "100%", transform: "translate(0, 0)" }}
          className="absolute top-0 right-0 z-40 transition-[width,transform] duration-200 ease-out motion-reduce:transition-none"
        >
          <div className="relative">
            <Input
              ref={inputRef}
              placeholder={placeholder}
              aria-label={placeholder}
              icon={SearchIcon}
              wrapperClassName="rounded-full"
              inputClassName="pr-9"
              value={value}
              onChange={onChange}
              onKeyDown={handleKeyDown}
            />
            {value.length > 0 && (
              <button
                type="button"
                aria-label="Clear search"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange("")}
                className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-fg-quaternary transition duration-100 ease-linear hover:text-fg-quaternary_hover focus:outline-hidden"
              >
                <XClose className="size-4 stroke-[2.25px]" />
              </button>
            )}
          </div>

          {expanded && (
            <div role="region" aria-label="Search syntax" className="absolute top-full right-0 left-0 mt-2 animate-in rounded-2xl bg-primary p-5 shadow-xl ring-1 ring-secondary duration-200 fade-in slide-in-from-top-1">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                {SEARCH_SYNTAX.map(({ example, meaning }) => (
                  <div key={example} className="flex flex-col">
                    <dt><code className="font-mono font-semibold text-primary">{example}</code></dt>
                    <dd className="text-tertiary">{meaning}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-secondary pt-3">
                <span className="text-xs text-tertiary">Press Enter to close the search and keep the filter.</span>
                {saveControl}
              </div>
            </div>
          )}
        </div>
      </div>
      {!expanded && saveControl}
    </>
  );
}
