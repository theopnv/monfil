// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Link } from 'react-aria-components';
import { Bookmark, Rss01 } from '@untitledui/icons';
import { useActiveWorkspaceId } from '@/providers/workspace-provider';
import { cx } from '@/components/untitled-ui/utils/cx';

export default function WorkspaceNavigation({ saved = false }: { saved?: boolean }) {
  const workspaceId = useActiveWorkspaceId();
  return (
    <nav aria-label="Workspace views" className="flex flex-col gap-1 px-2.5 pb-3">
      {[{ label: 'Feed', icon: Rss01, active: !saved, href: `/workspace/${workspaceId}` },
        { label: 'Saved', icon: Bookmark, active: saved, href: `/workspace/${workspaceId}?view=saved` }].map(({ label, icon: Icon, active, href }) => (
        <Link key={label} href={href} aria-current={active ? 'page' : undefined} className={cx(
          'flex items-center gap-2 rounded-xl px-2.25 py-2 text-sm font-semibold outline-brand focus-visible:outline-2',
          active ? 'bg-brand-secondary text-brand-secondary' : 'text-secondary hover:bg-secondary',
        )}>
          <Icon aria-hidden className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
