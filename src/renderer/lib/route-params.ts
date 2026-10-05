// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { redirect } from '@tanstack/react-router';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';
import { isPositiveSafeInteger } from '../../shared/validation';

export function parseRouteId(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0 || /\D/.test(value)) {
    return undefined;
  }
  const id = Number(value);
  return isPositiveSafeInteger(id) ? id : undefined;
}

export function parseWorkspaceParams<T extends { workspaceId: string; itemId?: string }>(params: T): T {
  if (parseRouteId(params.workspaceId) === undefined || (params.itemId !== undefined && parseRouteId(params.itemId) === undefined)) {
    throw redirect({ to: '/workspace/$workspaceId', params: { workspaceId: String(HOME_WORKSPACE_ID) }, replace: true });
  }
  return params;
}

export function parseCollectionSearch(search: Record<string, unknown>): { view?: 'saved' } {
  return search['view'] === 'saved' ? { view: 'saved' } : {};
}
