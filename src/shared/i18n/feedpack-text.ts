// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Feedpack, FeedpackText } from '../contracts';
import type { LanguageCode } from './languages';

/** The title and description of a feedpack in a language, or the English ones when the catalog has no translation. */
export function feedpackText(pack: Feedpack, language: LanguageCode): FeedpackText {
  return pack.i18n?.[language] ?? { title: pack.title, description: pack.description };
}
