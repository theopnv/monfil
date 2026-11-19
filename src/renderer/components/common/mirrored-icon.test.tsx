// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { ArrowLeft } from '@untitledui/icons';
import { mirrored } from './mirrored-icon';

const BackArrow = mirrored(ArrowLeft);

// The suite loads no stylesheet, so the tests check the class. The e2e spec for the language switch checks the pixels.
describe('mirrored', () => {
  test('flips the icon only where the layout runs right to left', async () => {
    // Act
    const { container } = await render(<BackArrow className="size-4" />);

    // Assert
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('rtl:-scale-x-100');
  });

  test('keeps the class names of the caller', async () => {
    // Act
    const { container } = await render(<BackArrow className="size-4 text-red-500" />);

    // Assert
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('size-4 text-red-500');
  });
});
