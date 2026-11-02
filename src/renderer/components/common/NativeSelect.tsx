// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ComponentProps } from "react";
import { ChevronDown } from "@untitledui/icons";

// The browser draws its own arrow flush against the right border, so the arrow is replaced to control its inset.
export default function NativeSelect({ children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className="w-full appearance-none rounded-lg border border-secondary bg-primary py-2 pr-10 pl-3 text-sm text-primary"
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-quaternary" />
    </div>
  );
}
