// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import config from './vite.config.mts';

describe('main Vite config', () => {
  test('marks exactly the runtime dependencies as external', () => {
    // Arrange
    const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { dependencies: Record<string, string> };
    const external = config.build?.rollupOptions?.external;

    // Act
    const externalNames = Array.isArray(external) ? [...external].sort() : external;

    // Assert
    expect(externalNames).toEqual(Object.keys(manifest.dependencies).sort());
  });
});
