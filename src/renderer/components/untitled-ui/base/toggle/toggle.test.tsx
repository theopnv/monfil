// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { Toggle } from './toggle';

// The suite loads no stylesheet, so the tests check the class. The language e2e spec checks the pixels.
async function knobClass(props: { size: 'sm' | 'md'; slim?: boolean; isSelected: boolean }) {
  const { container } = await render(<Toggle aria-label="Option" {...props} />);
  return container.querySelector('[class*="bg-fg-white"]')?.getAttribute('class') ?? '';
}

describe('Toggle', () => {
  test.each([
    ['sm', false, 'translate-x-4'],
    ['md', false, 'translate-x-5'],
    ['sm', true, 'translate-x-4'],
    ['md', true, 'translate-x-5'],
  ] as const)('moves the %s knob (slim: %s) toward the end of the track when on, in both directions', async (size, slim, shift) => {
    // Act
    const classes = await knobClass({ size, slim, isSelected: true });

    // Assert
    expect(classes.split(' ')).toContain(shift);
    expect(classes.split(' ')).toContain(`rtl:-${shift}`);
  });

  test('keeps the knob in place when the toggle is off', async () => {
    // Act
    const classes = await knobClass({ size: 'sm', isSelected: false });

    // Assert
    expect(classes).not.toContain('translate-x');
  });
});
