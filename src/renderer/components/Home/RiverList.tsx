// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useRef } from "react";
import SaveButton from "@/components/common/SaveButton";
import RiverCardArticle from "@/components/Home/RiverCardArticle";
import RiverCardCompact from "@/components/Home/RiverCardCompact";
import RiverCardMagazine from "@/components/Home/RiverCardMagazine";
import { useMasonryRows } from "@/lib/river/useMasonryRows";
import type { Density } from "@/lib/river/utils";
import type { RiverRow } from "../../../shared/contracts";

export interface RiverListProps {
  items: RiverRow[];
  density: Density;
  onOpen: (id: number) => void;
}

export default function RiverList({ items, density, onOpen }: RiverListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useMasonryRows(containerRef, density === 'Magazine');
  const Card = density === 'Magazine' ? RiverCardMagazine : density === 'Compact' ? RiverCardCompact : RiverCardArticle;
  const className = density === 'Magazine' ? 'grid auto-rows-[1px] grid-cols-2 items-start gap-x-3.5'
    : density === 'Compact' ? 'overflow-hidden rounded-xl border border-secondary bg-primary'
      : 'flex flex-col gap-3.5';
  return (
    <div ref={containerRef} className={className}>
      {items.map((item) => (
        <div key={item.id} className={density === 'Compact' ? 'relative border-b border-secondary last:border-b-0' : 'relative'}>
          <Card item={item} read={!!item.readAt} onOpen={onOpen} />
          <div className={density === 'Compact' ? 'absolute top-1/2 right-2 -translate-y-1/2' : 'absolute top-2 right-2'}>
            <SaveButton item={item} />
          </div>
        </div>
      ))}
    </div>
  );
}
