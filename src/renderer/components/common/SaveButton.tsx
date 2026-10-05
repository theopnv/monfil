// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Bookmark } from '@untitledui/icons';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { Tooltip } from '@/components/untitled-ui/base/tooltip/tooltip';
import { useSavedState } from '@/providers/saved-provider';
import type { RiverRow } from '../../../shared/contracts';

export default function SaveButton({ item, onRemoved }: { item: RiverRow; onRemoved?: () => void }) {
  const { setSaved, isPending } = useSavedState();
  const saved = item.savedAt != null;
  const label = saved ? 'Remove from Saved' : 'Save';
  return (
    <Tooltip title={label}>
      <Button
        type="button"
        aria-label={label}
        aria-pressed={saved}
        isDisabled={isPending}
        color="tertiary"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          setSaved(item.id, !saved, saved ? onRemoved : undefined);
        }}
        className="flex-none rounded-full"
        iconLeading={<Bookmark aria-hidden className={saved ? 'size-5 fill-current text-fg-brand-secondary' : 'size-5 text-fg-quaternary group-hover:text-fg-quaternary_hover'} />}
      />
    </Tooltip>
  );
}
