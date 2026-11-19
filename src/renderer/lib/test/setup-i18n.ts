// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach } from 'vitest';
import { i18n, setRendererLanguage } from '@/lib/i18n';

// Every test starts in English, whatever language the test before it left behind.
afterEach(async () => {
  if (i18n.language !== 'en') {
    await setRendererLanguage('en');
  }
});
