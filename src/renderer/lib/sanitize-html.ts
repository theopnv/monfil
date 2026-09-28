// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import DOMPurify from 'dompurify';
import { SANITIZE_CONFIG } from '../../shared/sanitize-html';

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
