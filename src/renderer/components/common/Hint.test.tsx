// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { useRef } from 'react';
import Hint from './Hint';

function Harness({ isOpen, onDismiss }: { isOpen: boolean; onDismiss: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} type="button">Anchor</button>
      <Hint triggerRef={ref} isOpen={isOpen} onDismiss={onDismiss} placement="bottom">Add a feed here.</Hint>
    </>
  );
}

describe('Hint', () => {
  test('shows its text and a "Got it" button next to the anchor', async () => {
    // Act
    const { getByText, getByRole } = await render(<Harness isOpen onDismiss={vi.fn()} />);

    // Assert
    await expect.element(getByText('Add a feed here.')).toBeInTheDocument();
    await expect.element(getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  test('renders nothing while closed', async () => {
    // Act
    const { getByText } = await render(<Harness isOpen={false} onDismiss={vi.fn()} />);

    // Assert
    await expect.element(getByText('Add a feed here.')).not.toBeInTheDocument();
  });

  test('"Got it" dismisses the hint', async () => {
    // Arrange
    const onDismiss = vi.fn();
    const { getByRole } = await render(<Harness isOpen onDismiss={onDismiss} />);

    // Act
    await getByRole('button', { name: 'Got it' }).click();

    // Assert
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test('Escape dismisses the hint', async () => {
    // Arrange
    const onDismiss = vi.fn();
    const { getByText } = await render(<Harness isOpen onDismiss={onDismiss} />);
    await expect.element(getByText('Add a feed here.')).toBeInTheDocument();

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    await vi.waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });
});
