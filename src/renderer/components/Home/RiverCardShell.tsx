// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ReactNode } from 'react';
import { cx } from '@/components/untitled-ui/utils/cx';
import type { RiverCardProps } from '@/lib/river/utils';

interface RiverCardShellProps extends RiverCardProps {
  as: 'article' | 'div';
  /** The screen-reader label, which says what the opacity of a read card cannot. */
  label: string;
  className: string;
  children: ReactNode;
}

export function RiverCardShell({ as: Tag, item, read, onOpen, label, className, children }: RiverCardShellProps) {
  return (
    <Tag
      data-item-id={item.id}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item.id);
        }
      }}
      className={cx(className, read && 'opacity-50')}
    >
      {children}
    </Tag>
  );
}

export function UnreadDot({ read }: { read: boolean }) {
  return <span aria-hidden className={cx('size-1.75 flex-none rounded-full', read ? 'bg-quaternary' : 'bg-brand-solid')} />;
}

export function CategoryChip({ name, className }: { name: string; className: string }) {
  return <span className={cx('rounded-full bg-sage-200 text-xs font-semibold text-sage-800', className)}>{name}</span>;
}
