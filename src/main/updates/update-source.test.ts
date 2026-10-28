// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { resolveUpdateSource, type UpdateEnvironment } from './update-source';

const installedOnWindows: UpdateEnvironment = {
  platform: 'win32',
  arch: 'x64',
  version: '1.2.3',
  isPackaged: true,
  isWindowsStore: false,
};

describe('resolveUpdateSource', () => {
  test('uses the release feed for a Windows installer build', () => {
    // Act
    const source = resolveUpdateSource(installedOnWindows);

    // Assert
    expect(source).toEqual({ name: 'FEED', url: 'https://update.electronjs.org/theopnv/monfil/win32-x64/1.2.3' });
  });

  test('leaves updates to the Store for a Store build', () => {
    // Act
    const source = resolveUpdateSource({ ...installedOnWindows, isWindowsStore: true });

    // Assert
    expect(source).toEqual({ name: 'STORE' });
  });

  test('does not update a development build', () => {
    // Act
    const source = resolveUpdateSource({ ...installedOnWindows, isPackaged: false });

    // Assert
    expect(source).toEqual({ name: 'NONE', reason: 'DEVELOPMENT' });
  });

  test('uses the release feed for a macOS build', () => {
    // Act
    const source = resolveUpdateSource({ ...installedOnWindows, platform: 'darwin', arch: 'arm64' });

    // Assert
    expect(source).toEqual({ name: 'FEED', url: 'https://update.electronjs.org/theopnv/monfil/darwin-arm64/1.2.3' });
  });

  test('does not update on Linux', () => {
    // Act
    const source = resolveUpdateSource({ ...installedOnWindows, platform: 'linux' });

    // Assert
    expect(source).toEqual({ name: 'NONE', reason: 'UNSUPPORTED_PLATFORM' });
  });
});
