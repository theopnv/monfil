import { describe, expect, test } from 'vitest';
import path from 'node:path';
import { resolveDevUserDataDir } from './dev-user-data-dir';

describe('resolveDevUserDataDir', () => {
  test('leaves userData alone when packaged', () => {
    // Arrange
    const input = { isPackaged: true, hasExplicitUserDataDir: false, appDataDir: '/app-data', appName: 'monfil' };

    // Act
    const result = resolveDevUserDataDir(input);

    // Assert
    expect(result).toBeNull();
  });

  test('leaves userData alone when unpackaged with an explicit --user-data-dir', () => {
    // Arrange
    const input = { isPackaged: false, hasExplicitUserDataDir: true, appDataDir: '/app-data', appName: 'monfil' };

    // Act
    const result = resolveDevUserDataDir(input);

    // Assert
    expect(result).toBeNull();
  });

  test('points unpackaged runs at a sibling -dev directory', () => {
    // Arrange
    const input = { isPackaged: false, hasExplicitUserDataDir: false, appDataDir: '/app-data', appName: 'monfil' };

    // Act
    const result = resolveDevUserDataDir(input);

    // Assert
    expect(result).toBe(path.join('/app-data', 'monfil-dev'));
  });

  test('leaves userData alone when both packaged and an explicit switch are set', () => {
    // Arrange
    const input = { isPackaged: true, hasExplicitUserDataDir: true, appDataDir: '/app-data', appName: 'monfil' };

    // Act
    const result = resolveDevUserDataDir(input);

    // Assert
    expect(result).toBeNull();
  });
});
