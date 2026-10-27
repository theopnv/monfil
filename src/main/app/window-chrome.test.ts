// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { titleBarOverlayForTheme } from './window-chrome';

function brightness(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return 0.299 * (red ?? 0) + 0.587 * (green ?? 0) + 0.114 * (blue ?? 0);
}

describe('titleBarOverlayForTheme', () => {
  test('gives a dark bar with light window buttons in the dark theme', () => {
    // Act
    const overlay = titleBarOverlayForTheme('dark');

    // Assert
    expect(overlay.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(overlay.symbolColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(brightness(overlay.color)).toBeLessThan(brightness(overlay.symbolColor));
    expect(brightness(overlay.color)).toBeLessThan(128);
  });

  test('gives a light bar with dark window buttons in the light theme', () => {
    // Act
    const overlay = titleBarOverlayForTheme('light');

    // Assert
    expect(overlay.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(overlay.symbolColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(brightness(overlay.color)).toBeGreaterThan(brightness(overlay.symbolColor));
    expect(brightness(overlay.color)).toBeGreaterThan(128);
  });

  test.each(['dark', 'light'] as const)('keeps the same bar height in the %s theme', (theme) => {
    // Act & Assert
    expect(titleBarOverlayForTheme(theme).height).toBe(titleBarOverlayForTheme(theme === 'dark' ? 'light' : 'dark').height);
    expect(titleBarOverlayForTheme(theme).height).toBeGreaterThan(0);
  });
});
