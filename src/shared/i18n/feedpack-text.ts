// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Feedpack, FeedpackText } from '../contracts';
import type { LanguageCode } from './languages';

export function feedpackText(pack: Feedpack, language: LanguageCode): FeedpackText {
  return pack.i18n?.[language] ?? { title: pack.title, description: pack.description };
}
