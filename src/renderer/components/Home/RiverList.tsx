// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import SaveButton from "@/components/common/SaveButton";
import RiverCardArticle from "@/components/Home/RiverCardArticle";
import RiverCardCompact from "@/components/Home/RiverCardCompact";
import RiverCardMagazine from "@/components/Home/RiverCardMagazine";
import type { Density } from "@/lib/river/utils";
import type { RiverRow } from "../../../shared/contracts";

export interface RiverListProps {
  items: RiverRow[];
  density: Density;
  onOpen: (id: number) => void;
}

export default function RiverList({ items, density, onOpen }: RiverListProps) {
  const Card = density === 'Magazine' ? RiverCardMagazine : density === 'Compact' ? RiverCardCompact : RiverCardArticle;
  const className = density === 'Magazine' ? 'grid grid-cols-2 gap-3.5'
    : density === 'Compact' ? 'overflow-hidden rounded-xl border border-secondary bg-primary'
      : 'flex flex-col gap-3.5';
  return (
    <div className={className}>
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
