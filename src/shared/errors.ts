// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { LogLevel } from './logging';

export type ErrorSurface = 'field' | 'toast' | 'section' | 'fatal';

export type ErrorPolicy<E extends { name: string }> = {
  [Name in E['name']]: {
    surface: ErrorSurface;
    level: LogLevel | 'none';
    message: string;
    retry: 'safe' | 'none';
  };
};
