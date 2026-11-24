// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createFileRoute } from '@tanstack/react-router';
import { redirectToFirstWorkspace } from '@/lib/route-params';

export const Route = createFileRoute('/')({
  beforeLoad: redirectToFirstWorkspace,
});
