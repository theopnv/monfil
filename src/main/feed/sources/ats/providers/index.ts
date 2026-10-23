// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { toUrl } from '../../feedSource';
import type { AtsBoard, AtsProviderAdapter } from '../types';
import { ashby } from './ashby';
import { greenhouse } from './greenhouse';
import { lever } from './lever';
import { personio } from './personio';
import { recruitee } from './recruitee';
import { smartrecruiters } from './smartrecruiters';
import { teamtailor } from './teamtailor';
import { workable } from './workable';

export const PROVIDERS: AtsProviderAdapter[] = [greenhouse, lever, ashby, workable, smartrecruiters, recruitee, teamtailor, personio];

export function providerFor(board: AtsBoard): AtsProviderAdapter | undefined {
  return PROVIDERS.find((adapter) => adapter.provider === board.provider);
}

/** The ATS board a board page or API URL belongs to, or null. */
export function toBoard(raw: string): AtsBoard | null {
  const url = toUrl(raw);
  if (!url || !/^https?:$/.test(url.protocol)) {
    return null;
  }
  for (const adapter of PROVIDERS) {
    const board = adapter.toBoard(url);
    if (board) {
      return board;
    }
  }
  return null;
}
