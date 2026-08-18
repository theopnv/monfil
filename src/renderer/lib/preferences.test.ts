import { beforeEach, describe, expect, test } from 'vitest';
import { loadPreferences, savePreference } from './preferences';

beforeEach(() => {
  localStorage.clear();
});

describe('loadPreferences', () => {
  test('returns the defaults when nothing is stored', () => {
    // Act
    const preferences = loadPreferences();

    // Assert
    expect(preferences).toEqual({
      density: 'Cards',
      hideReadItems: false,
      markReadOnScroll: true,
      openLinksExternally: false,
    });
  });

  test('falls back to the default for malformed JSON', () => {
    // Arrange
    localStorage.setItem('preferences-density', '{not json');
    localStorage.setItem('preferences-hide-read-items', '{not json');

    // Act
    const preferences = loadPreferences();

    // Assert
    expect(preferences.density).toBe('Cards');
    expect(preferences.hideReadItems).toBe(false);
  });

  test('falls back to the default for an out-of-range enum value', () => {
    // Arrange
    localStorage.setItem('preferences-density', JSON.stringify('Nonsense'));

    // Act
    const preferences = loadPreferences();

    // Assert
    expect(preferences.density).toBe('Cards');
  });

  test('falls back to the default when a boolean key holds a non-boolean value', () => {
    // Arrange
    localStorage.setItem('preferences-mark-read-on-scroll', JSON.stringify('yes'));

    // Act
    const preferences = loadPreferences();

    // Assert
    expect(preferences.markReadOnScroll).toBe(true);
  });
});

describe('savePreference', () => {
  test('round-trips every preference through loadPreferences', () => {
    // Act
    savePreference('density', 'Compact');
    savePreference('hideReadItems', true);
    savePreference('markReadOnScroll', false);
    savePreference('openLinksExternally', true);

    // Assert
    expect(loadPreferences()).toEqual({
      density: 'Compact',
      hideReadItems: true,
      markReadOnScroll: false,
      openLinksExternally: true,
    });
  });
});
