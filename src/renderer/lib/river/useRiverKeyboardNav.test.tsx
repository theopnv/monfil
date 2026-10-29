// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useRef } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { useRiverKeyboardNav } from './useRiverKeyboardNav';

function Harness({ enabled = true, cardCount = 3 }: { enabled?: boolean; cardCount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useRiverKeyboardNav(ref, enabled);
  return (
    <div>
      <input aria-label="field" />
      <textarea aria-label="notes" />
      <div aria-label="editor" role="textbox" contentEditable suppressContentEditableWarning tabIndex={0} />
      <div ref={ref} data-testid="list" style={{ height: 250, overflow: 'auto' }}>
        {Array.from({ length: cardCount }, (_, index) => (
          <button key={index} type="button" data-item-id={index + 1} style={{ display: 'block', height: 100 }}>
            Card {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

const card = (n: number) => document.querySelector<HTMLElement>(`[data-item-id="${n}"]`);

test('j focuses the first card when no card has focus, then each next card, and stays on the last', async () => {
  // Arrange
  await render(<Harness />);

  // Act
  press('j');

  // Assert
  expect(document.activeElement).toBe(card(1));

  // Act
  press('j');
  press('j');

  // Assert
  expect(document.activeElement).toBe(card(3));

  // Act
  press('j');

  // Assert
  expect(document.activeElement).toBe(card(3));
});

test('k focuses the first card when no card has focus', async () => {
  // Arrange
  await render(<Harness />);

  // Act
  press('k');

  // Assert
  expect(document.activeElement).toBe(card(1));
});

test('k moves back one card at a time and stays on the first', async () => {
  // Arrange
  await render(<Harness />);
  card(3)?.focus();

  // Act
  press('k');

  // Assert
  expect(document.activeElement).toBe(card(2));

  // Act
  press('k');
  press('k');

  // Assert
  expect(document.activeElement).toBe(card(1));
});

test('a card that is already in view is not scrolled to the top', async () => {
  // Arrange
  const { getByTestId } = await render(<Harness />);

  // Act
  press('j');
  press('j');

  // Assert
  expect(document.activeElement).toBe(card(2));
  expect(getByTestId('list').element().scrollTop).toBe(0);
});

test('does nothing when the list has no card', async () => {
  // Arrange
  await render(<Harness cardCount={0} />);
  const before = document.activeElement;

  // Act
  press('j');
  press('k');

  // Assert
  expect(document.activeElement).toBe(before);
});

test.each([
  { label: 'an input', name: 'field' },
  { label: 'a textarea', name: 'notes' },
  { label: 'a content-editable element', name: 'editor' },
])('does not move focus while the user types in $label', async ({ name }) => {
  // Arrange
  const { getByLabelText } = await render(<Harness />);
  const field = getByLabelText(name).element() as HTMLElement;
  field.focus();

  // Act
  press('j', {}, field);
  press('k', {}, field);

  // Assert
  expect(document.activeElement).toBe(field);
});

test.each([
  { modifier: 'metaKey' },
  { modifier: 'ctrlKey' },
  { modifier: 'altKey' },
])('does not move focus when $modifier is held', async ({ modifier }) => {
  // Arrange
  await render(<Harness />);

  // Act
  press('j', { [modifier]: true });
  press('k', { [modifier]: true });

  // Assert
  expect(document.activeElement).toBe(document.body);
});

test('ignores keys other than j and k', async () => {
  // Arrange
  await render(<Harness />);

  // Act
  press('x');
  press('ArrowDown');

  // Assert
  expect(document.activeElement).toBe(document.body);
});

test('does not move focus while disabled, and starts to once enabled', async () => {
  // Arrange
  const { rerender } = await render(<Harness enabled={false} />);

  // Act
  press('j');

  // Assert
  expect(document.activeElement).toBe(document.body);

  // Act
  await rerender(<Harness enabled />);
  press('j');

  // Assert
  expect(document.activeElement).toBe(card(1));
});

test('stops listening to keys once the hook unmounts', async () => {
  // Arrange
  const container = document.createElement('div');
  container.innerHTML = '<button type="button" data-item-id="1">Card 1</button>';
  document.body.append(container);
  const containerRef = { current: container };
  function Listener() {
    useRiverKeyboardNav(containerRef, true);
    return null;
  }
  const { unmount } = await render(<Listener />);

  // Act
  await unmount();
  press('j');

  // Assert
  expect(document.activeElement).toBe(document.body);
  container.remove();
});
