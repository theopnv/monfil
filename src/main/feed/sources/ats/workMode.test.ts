// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { detectWorkMode, normalizeWorkMode } from './workMode';

describe('normalizeWorkMode', () => {
  test.each([
    ['Remote', 'remote'], ['fully', 'remote'], ['Hybrid', 'hybrid'], ['OnSite', 'on-site'], ['on-site', 'on-site'], ['none', 'on-site'], ['unknown', undefined], ['', undefined], [undefined, undefined],
  ] as const)('reads %j as %j', (value, expected) => {
    // Act / Assert
    expect(normalizeWorkMode(value)).toBe(expected);
  });
});

describe('detectWorkMode', () => {
  test('prefers the provider field over the texts', () => {
    // Act / Assert
    expect(detectWorkMode('hybrid', 'Remote - US')).toBe('hybrid');
  });

  test.each([
    ['Paris (Remote)', 'remote'],
    ['Paris, télétravail possible', 'remote'],
    ['Hybrid remote, London', 'hybrid'],
    ['Paris - Hybride', 'hybrid'],
    ['Lyon (sur site)', 'on-site'],
    ['Berlin', undefined],
  ] as const)('reads %j as %j', (location, expected) => {
    // Act / Assert
    expect(detectWorkMode(undefined, location)).toBe(expected);
  });

  test('falls back to the title and skips missing texts', () => {
    // Act / Assert
    expect(detectWorkMode(undefined, undefined, 'Remote Backend Engineer')).toBe('remote');
  });
});
