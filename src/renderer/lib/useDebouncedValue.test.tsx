// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { useDebouncedValue } from './useDebouncedValue';

function Probe({ value, delayMs }: { value: string; delayMs: number }) {
  const debounced = useDebouncedValue(value, delayMs);
  return <span data-testid="value">{debounced}</span>;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('follows the value once it stayed the same for the delay', async () => {
  // Arrange
  const screen = await render(<Probe value="a" delayMs={100} />);

  // Act
  await screen.rerender(<Probe value="b" delayMs={100} />);

  // Assert
  await expect.element(screen.getByTestId('value')).toHaveTextContent('a');
  await expect.element(screen.getByTestId('value')).toHaveTextContent('b');
});

test('skips a value that was replaced before the delay passed', async () => {
  // Arrange
  const screen = await render(<Probe value="a" delayMs={400} />);
  await screen.rerender(<Probe value="b" delayMs={400} />);
  await wait(200);

  // Act
  await screen.rerender(<Probe value="c" delayMs={400} />);
  await wait(300);

  // Assert
  await expect.element(screen.getByTestId('value')).toHaveTextContent('a');
  await expect.element(screen.getByTestId('value')).toHaveTextContent('c');
});
