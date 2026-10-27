// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { detectWorkMode, normalizeWorkMode } from './workMode';

describe('normalizeWorkMode', () => {
  test.each([
    ['Remote', 'remote'], ['fully', 'remote'], ['Hybrid', 'hybrid'], ['OnSite', 'on-site'], ['on-site', 'on-site'], ['none', 'on-site'], ['unknown', undefined], ['', undefined], [undefined, undefined],
    ['Fully Remote', 'remote'], ['fully_remote', 'remote'], ['TELECOMMUTING', 'remote'], ['Office', 'on-site'], ['hybrid_flex', 'hybrid'], ['Hybrid - 3 days', 'hybrid'],
    ['  remote  ', 'remote'], ['flex-hybrid', undefined], ['   ', undefined],
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
    ['Berlin (on-site)', 'on-site'],
    ['Work from home', 'remote'],
    ['Lyon, présentiel', 'on-site'],
  ] as const)('reads %j as %j', (location, expected) => {
    // Act / Assert
    expect(detectWorkMode(undefined, location)).toBe(expected);
  });

  test('falls back to the title and skips missing texts', () => {
    // Act / Assert
    expect(detectWorkMode(undefined, undefined, 'Remote Backend Engineer')).toBe('remote');
  });

  test('reads the texts as one text, so a missing text leaves the others as they are', () => {
    // Act / Assert
    expect(detectWorkMode(undefined, undefined, 'Berlin', undefined, 'Hybrid')).toBe('hybrid');
    expect(detectWorkMode(undefined, undefined, undefined)).toBeUndefined();
  });

  test('lets an unknown provider value fall through to the texts', () => {
    // Act / Assert
    expect(detectWorkMode('flexible', 'Paris (Remote)')).toBe('remote');
  });
});
