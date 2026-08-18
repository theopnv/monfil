import { beforeEach, describe, expect, test } from 'vitest';
import { readLocalStorageJSON, writeLocalStorageJSON } from './local-storage';

beforeEach(() => {
  localStorage.clear();
});

describe('writeLocalStorageJSON / readLocalStorageJSON', () => {
  test('round-trips a value through JSON', () => {
    // Act
    writeLocalStorageJSON('key', { a: 1, b: ['x', 'y'] });

    // Assert
    expect(readLocalStorageJSON('key')).toEqual({ a: 1, b: ['x', 'y'] });
  });

  test('returns undefined for a missing key', () => {
    // Act
    const result = readLocalStorageJSON('missing');

    // Assert
    expect(result).toBeUndefined();
  });

  test('returns undefined for malformed JSON', () => {
    // Arrange
    localStorage.setItem('key', '{not json');

    // Act
    const result = readLocalStorageJSON('key');

    // Assert
    expect(result).toBeUndefined();
  });
});
