// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useNavigate, useSearch } from "@tanstack/react-router";
import River from "./River";
import { useActiveWorkspaceId } from "@/providers/workspace-provider";

export default function Home() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const workspaceId = useActiveWorkspaceId();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <River savedView={search.view === 'saved'} onShowFeed={() => navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(workspaceId) }, search: {} })} onOpenItem={(id) => navigate({ to: '/workspace/$workspaceId/reader/$itemId', params: { workspaceId: String(workspaceId), itemId: String(id) }, search })} />
    </div>
  );
}
