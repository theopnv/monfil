import { expect, test } from 'vitest';
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

  // Act
  announce('Marked as read');

  // Assert: cleared immediately so a screen reader sees the text change again.
  await expect.element(region).toHaveTextContent('');
  await expect.element(region).toHaveTextContent('Marked as read');
});
