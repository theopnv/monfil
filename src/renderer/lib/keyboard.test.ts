// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';

type Modifiers = { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

const NONE: Modifiers = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

let loads = 0;

// The platform is read when the module loads, and a query makes the browser load a fresh copy of it for each user agent.
async function loadKeyboard(userAgent: string): Promise<typeof import('./keyboard')> {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  loads += 1;
  return import(/* @vite-ignore */ `./keyboard.ts?load=${loads}`) as Promise<typeof import('./keyboard')>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('on macOS', () => {
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

  test('labels the modifier with the command symbol', async () => {
    // Act
    const { MOD_KEY_LABEL } = await loadKeyboard(MAC);

    // Assert
    expect(MOD_KEY_LABEL).toBe('⌘');
  });

  test.each([
    { held: { metaKey: true }, expected: true },
    { held: {}, expected: false },
    { held: { ctrlKey: true }, expected: false },
    { held: { metaKey: true, ctrlKey: true }, expected: false },
    { held: { metaKey: true, altKey: true }, expected: false },
    { held: { metaKey: true, shiftKey: true }, expected: false },
  ])('hasOnlyModKey is $expected while $held is held', async ({ held, expected }) => {
    // Arrange
    const { hasOnlyModKey } = await loadKeyboard(MAC);

    // Act
    const result = hasOnlyModKey({ ...NONE, ...held });

    // Assert
    expect(result).toBe(expected);
  });
});

describe('on other platforms', () => {
  const LINUX = 'Mozilla/5.0 (X11; Linux x86_64)';

  test('labels the modifier with Ctrl', async () => {
    // Act
    const { MOD_KEY_LABEL } = await loadKeyboard(LINUX);

    // Assert
    expect(MOD_KEY_LABEL).toBe('Ctrl+');
  });

  test.each([
    { held: { ctrlKey: true }, expected: true },
    { held: {}, expected: false },
    { held: { metaKey: true }, expected: false },
    { held: { ctrlKey: true, metaKey: true }, expected: false },
    { held: { ctrlKey: true, altKey: true }, expected: false },
    { held: { ctrlKey: true, shiftKey: true }, expected: false },
  ])('hasOnlyModKey is $expected while $held is held', async ({ held, expected }) => {
    // Arrange
    const { hasOnlyModKey } = await loadKeyboard(LINUX);

    // Act
    const result = hasOnlyModKey({ ...NONE, ...held });

    // Assert
    expect(result).toBe(expected);
  });
});
