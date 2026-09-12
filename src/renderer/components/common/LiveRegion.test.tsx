import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { announce } from '@/lib/announcer';
import LiveRegion from './LiveRegion';

test('renders an announced message inside a polite status region', async () => {
  // Arrange
  const { getByRole } = await render(<LiveRegion />);

  // Act
  announce('Feeds refreshed.');

  // Assert
  const region = getByRole('status');
  await expect.element(region).toHaveTextContent('Feeds refreshed.');
  await expect.element(region).toHaveAttribute('aria-live', 'polite');
});

test('re-announces a repeated message by clearing it first', async () => {
  // Arrange
  const { getByRole } = await render(<LiveRegion />);
  const region = getByRole('status');
  announce('Marked as read');
  await expect.element(region).toHaveTextContent('Marked as read');

  // The target text is already "Marked as read" before the second announce, so a
  // polling DOM assertion for that same value can resolve immediately without ever
  // observing the clear-then-reset cycle. Record every mutation instead and wait on
  // that record directly.
  const element = region.element();
  const seenTextValues: string[] = [];
  const observer = new MutationObserver(() => {
    seenTextValues.push(element.textContent ?? '');
  });
  observer.observe(element, { childList: true, characterData: true, subtree: true });

  // Act: announcing the same message again must still touch the DOM, not no-op.
  announce('Marked as read');
  await vi.waitFor(() => {
    expect(seenTextValues).toEqual(['', 'Marked as read']);
  });
  observer.disconnect();
});
