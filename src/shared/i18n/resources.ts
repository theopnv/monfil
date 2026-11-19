// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import enCommon from './locales/en/common.json';

export const NAMESPACES = ['common'] as const;
export const DEFAULT_NAMESPACE = 'common';

// Every language ships in the bundle: the app works offline and a language switch needs no loading step.
export const resources = {
  en: { common: enCommon },
};
