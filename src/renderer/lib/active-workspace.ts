// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createContext, useContext } from 'react';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';

export const ActiveWorkspaceIdContext = createContext<number>(HOME_WORKSPACE_ID);

/** The workspace the URL currently points at, or Home for a component tree with no provider (most unit tests). */
export const useActiveWorkspaceId = (): number => useContext(ActiveWorkspaceIdContext);
