// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ElectronHandler } from '../shared/channels';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

export { };
