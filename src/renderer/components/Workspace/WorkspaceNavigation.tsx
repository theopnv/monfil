// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useRef } from 'react';
import { Link } from 'react-aria-components';
import { Bookmark, Rss01 } from '@untitledui/icons';
import Hint from '@/components/common/Hint';
import { useHint } from '@/providers/hints-provider';
import { useActiveWorkspaceId } from '@/providers/workspace-provider';
import { cx } from '@/components/untitled-ui/utils/cx';

export default function WorkspaceNavigation({ saved = false, hasFeeds = false }: { saved?: boolean; hasFeeds?: boolean }) {
  const workspaceId = useActiveWorkspaceId();
  const savedLinkRef = useRef<HTMLAnchorElement>(null);
  const saveHint = useHint('save', { ready: hasFeeds });
  return (
    <nav aria-label="Workspace views" className="flex flex-col gap-1 px-2.5 pb-3">
      {[{ label: 'All items', icon: Rss01, active: !saved, href: `/workspace/${workspaceId}` },
        { label: 'Saved', icon: Bookmark, active: saved, href: `/workspace/${workspaceId}?view=saved` }].map(({ label, icon: Icon, active, href }) => (
        <Link key={label} ref={label === 'Saved' ? savedLinkRef : undefined} href={href} {...(active && { 'aria-current': 'page' as const })} className={cx(
          'flex items-center gap-2 rounded-xl px-2.25 py-2 text-sm font-semibold outline-brand focus-visible:outline-2',
          active ? 'bg-brand-secondary text-brand-secondary' : 'text-secondary hover:bg-secondary',
        )}>
          <Icon aria-hidden className="size-4" />
          {label}
        </Link>
      ))}
      <Hint triggerRef={savedLinkRef} isOpen={saveHint.isOpen} onDismiss={saveHint.dismiss} placement="right">
        Save an article with the bookmark. Find your saved articles here.
      </Hint>
    </nav>
  );
}
