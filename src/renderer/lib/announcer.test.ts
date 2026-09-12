import { expect, test, vi } from 'vitest';
import { announce, subscribeToAnnouncements } from './announcer';

test('notifies every subscribed listener with the message', () => {
  // Arrange
  const listener = vi.fn();
  const unsubscribe = subscribeToAnnouncements(listener);

  // Act
  announce('Feeds refreshed');

  // Assert
  expect(listener).toHaveBeenCalledWith('Feeds refreshed');
  unsubscribe();
});

test('does nothing when no listener is subscribed', () => {
  // Act & Assert: announcing without a mounted LiveRegion must not throw.
  expect(() => announce('Marked as read')).not.toThrow();
});

test('stops notifying a listener once unsubscribed', () => {
  // Arrange
  const listener = vi.fn();
  const unsubscribe = subscribeToAnnouncements(listener);
  unsubscribe();

  // Act
  announce('No results for "quantum"');

  // Assert
  expect(listener).not.toHaveBeenCalled();
});
