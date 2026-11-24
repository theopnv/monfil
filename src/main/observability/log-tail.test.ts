// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readLogTail } from './log-tail';

let directory: string;
let file: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'monfil-log-'));
  file = path.join(directory, 'monfil.log');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('readLogTail', () => {
  test('reads a short log whole', async () => {
    // Arrange
    await writeFile(file, 'one\ntwo\n');

    // Act, Assert
    await expect(readLogTail(file, 100)).resolves.toEqual({ text: 'one\ntwo\n', truncated: false });
  });

  test('reads a log that is exactly as long as the limit whole', async () => {
    // Arrange
    await writeFile(file, 'abcd');

    // Act, Assert
    await expect(readLogTail(file, 4)).resolves.toEqual({ text: 'abcd', truncated: false });
  });

  test('keeps the end of a long log and starts at a whole line', async () => {
    // Arrange
    await writeFile(file, 'first line\nsecond line\nthird line\n');

    // Act
    const tail = await readLogTail(file, 20);

    // Assert
    expect(tail).toEqual({ text: 'third line\n', truncated: true });
  });

  test('keeps the cut text when the end has no line break', async () => {
    // Arrange
    await writeFile(file, 'abcdefghij');

    // Act, Assert
    await expect(readLogTail(file, 4)).resolves.toEqual({ text: 'ghij', truncated: true });
  });

  test('reads a missing file as empty', async () => {
    // Act, Assert
    await expect(readLogTail(path.join(directory, 'none.log'), 100)).resolves.toEqual({ text: '', truncated: false });
  });

  test('reads an empty file as empty', async () => {
    // Arrange
    await writeFile(file, '');

    // Act, Assert
    await expect(readLogTail(file, 100)).resolves.toEqual({ text: '', truncated: false });
  });
});
