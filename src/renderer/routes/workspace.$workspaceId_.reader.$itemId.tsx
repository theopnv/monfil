// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import Reader from '@/components/Reader/Reader';
import { parseWorkspaceParams } from '@/lib/route-params';

export const Route = createFileRoute('/workspace/$workspaceId_/reader/$itemId')({
  params: { parse: (params) => parseWorkspaceParams(params) },
  component: ReaderRoute,
});

function ReaderRoute() {
  const { workspaceId, itemId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <Reader
      itemId={itemId}
      onNavigateToItem={(id) => navigate({ to: '/workspace/$workspaceId/reader/$itemId', params: { workspaceId, itemId: String(id) } })}
      onNavigateHome={() => navigate({ to: '/workspace/$workspaceId', params: { workspaceId } })}
    />
  );
}
