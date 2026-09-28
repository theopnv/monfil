// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createFileRoute } from '@tanstack/react-router';
import Settings from '@/components/Settings/Settings';

export const Route = createFileRoute('/settings')({
  component: Settings,
});
