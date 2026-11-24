// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { open } from 'node:fs/promises';
import type { ErrorReportLogPreview } from '../../shared/contracts';

/** Reads the end of a log file, from a line start, up to `maxBytes`. A missing file reads as empty. */
export async function readLogTail(filePath: string, maxBytes: number): Promise<ErrorReportLogPreview> {
  let handle;
  try {
    handle = await open(filePath, 'r');
  } catch {
    return { text: '', truncated: false };
  }
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    const text = buffer.toString('utf8');
    if (length === size) {
      return { text, truncated: false };
    }
    const firstLineBreak = text.indexOf('\n');
    return { text: firstLineBreak === -1 ? text : text.slice(firstLineBreak + 1), truncated: true };
  } finally {
    await handle.close();
  }
}
