// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import Home from '@/components/Home/Home';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/workspace/$workspaceId')({
  component: Home,
});
