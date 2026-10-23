// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, useRef } from 'react';
import { ipc } from '@/lib/ipc-client';
import { recordUsage } from '@/lib/usage';
import { usePreferences } from '@/providers/preferences-provider';
import { useTheme } from '@/providers/theme-provider';
import { useActiveWorkspaceId } from '@/providers/workspace-provider';

/**
 * Reports the display settings and workspace switches to the main process for the optional usage stats.
 * Mount it once, high in the tree.
 */
export function useUsageReporting(): void {
  const { preferences } = usePreferences();
  const { theme } = useTheme();
  const workspaceId = useActiveWorkspaceId();
  const previousWorkspaceId = useRef(workspaceId);

  useEffect(() => {
    ipc.send('usage:preferences', { ...preferences, theme });
  }, [preferences, theme]);

  useEffect(() => {
    if (previousWorkspaceId.current !== workspaceId) {
      previousWorkspaceId.current = workspaceId;
      recordUsage('workspaces_switched');
    }
  }, [workspaceId]);
}
