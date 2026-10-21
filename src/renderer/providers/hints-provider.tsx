// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { activeHint, HINT_ORDER, readHintsState, writeHintsState, type HintId } from '@/lib/hints';
import { ipc, rendererLogger } from '@/lib/ipc-client';
import { feedsQuery, workspacesQuery } from '@/lib/queries';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';

interface HintsContextType {
  /** The hint that may be open right now, if any. */
  openHint: HintId | undefined;
  setAnchor: (id: HintId, ready: boolean) => void;
  removeAnchor: (id: HintId) => void;
  dismiss: (id: HintId) => void;
}

const noop = () => undefined;
const HintsContext = createContext<HintsContextType>({ openHint: undefined, setAnchor: noop, removeAnchor: noop, dismiss: noop });

type Phase = 'checking' | 'ready';

/**
 * A profile that already has feeds or several workspaces belongs to a current user: the hints would
 * teach them what they know, so every hint is marked seen. A fresh profile starts at the first hint.
 */
async function resolveSeen(queryClient: ReturnType<typeof useQueryClient>): Promise<HintId[]> {
  const [feeds, workspaces] = await Promise.all([
    queryClient.fetchQuery(feedsQuery(HOME_WORKSPACE_ID)),
    queryClient.fetchQuery(workspacesQuery()),
  ]);
  return feeds.length > 0 || workspaces.length > 1 ? [...HINT_ORDER] : [];
}

export const HintsProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('checking');
  const [seen, setSeen] = useState<ReadonlySet<HintId>>(() => new Set(readHintsState().seen));
  const [anchors, setAnchors] = useState<ReadonlyMap<HintId, boolean>>(() => new Map());
  // Off in e2e runs: a profile that never showed hints must not be marked as having seen them.
  const [persistable, setPersistable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!(await ipc.invoke('app:hints-enabled', undefined))) {
        setSeen(new Set(HINT_ORDER));
        setPhase('ready');
        return;
      }
      const initialSeen = readHintsState().initialized ? undefined : await resolveSeen(queryClient);
      if (cancelled) {
        return;
      }
      if (initialSeen) {
        setSeen(new Set(initialSeen));
      }
      setPersistable(true);
      setPhase('ready');
    }
    // A failed check leaves the hints closed for this session; the next launch tries again.
    check().catch((error: unknown) => rendererLogger.warn('renderer.failure', { message: 'Hints check failed' }, error));
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(() => {
    if (persistable) {
      writeHintsState({ initialized: true, seen: HINT_ORDER.filter((id) => seen.has(id)) });
    }
  }, [persistable, seen]);

  const setAnchor = useCallback((id: HintId, ready: boolean) => {
    setAnchors((prev) => (prev.get(id) === ready ? prev : new Map(prev).set(id, ready)));
  }, []);

  const removeAnchor = useCallback((id: HintId) => {
    setAnchors((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const dismiss = useCallback((id: HintId) => {
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const openHint = phase === 'ready' ? activeHint(seen, anchors) : undefined;
  const value = useMemo(() => ({ openHint, setAnchor, removeAnchor, dismiss }), [openHint, setAnchor, removeAnchor, dismiss]);

  return <HintsContext.Provider value={value}>{children}</HintsContext.Provider>;
};

/**
 * Registers the calling component as the anchor of hint `id` while it is mounted.
 *
 * @return `isOpen` when the hint is the first unseen one and `ready`; `dismiss` marks it seen.
 */
export function useHint(id: HintId, { ready }: { ready: boolean }): { isOpen: boolean; dismiss: () => void } {
  const { openHint, setAnchor, removeAnchor, dismiss } = useContext(HintsContext);

  useEffect(() => {
    setAnchor(id, ready);
    return () => removeAnchor(id);
  }, [id, ready, setAnchor, removeAnchor]);

  const dismissHint = useCallback(() => dismiss(id), [dismiss, id]);
  return { isOpen: openHint === id, dismiss: dismissHint };
}
