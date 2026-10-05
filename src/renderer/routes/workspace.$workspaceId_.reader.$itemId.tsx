// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import Reader from '@/components/Reader/Reader';
import { parseCollectionSearch, parseWorkspaceParams } from '@/lib/route-params';

export const Route = createFileRoute('/workspace/$workspaceId_/reader/$itemId')({
  validateSearch: parseCollectionSearch,
  params: { parse: (params) => parseWorkspaceParams(params) },
  component: ReaderRoute,
});

function ReaderRoute() {
  const { workspaceId, itemId } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();

  return (
    <Reader
      itemId={itemId}
      savedView={search.view === 'saved'}
      onShowFeed={() => navigate({ to: '/workspace/$workspaceId', params: { workspaceId }, search: {} })}
      onNavigateToItem={(id) => navigate({ to: '/workspace/$workspaceId/reader/$itemId', params: { workspaceId, itemId: String(id) }, search })}
      onNavigateHome={() => navigate({ to: '/workspace/$workspaceId', params: { workspaceId }, search })}
    />
  );
}
