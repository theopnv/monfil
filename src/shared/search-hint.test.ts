// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { DEFAULT_HINT_EXAMPLE, pickHintExample } from './search-hint';

describe('pickHintExample', () => {
  test('uses the most common role word', () => {
    // Act / Assert
    expect(pickHintExample(['Backend Engineer', 'Frontend Engineer', 'Designer'])).toBe('title:engineer -manager');
    expect(pickHintExample(['Product Designer', 'UX Designer', 'Designer'])).toBe('title:designer -lead');
  });

  test('counts a word once per title', () => {
    // Act / Assert
    expect(pickHintExample(['Engineer engineer engineer', 'Designer', 'Designer'])).toBe('title:designer -lead');
  });

  test('falls back to the default when no role word appears', () => {
    // Act / Assert
    expect(pickHintExample(['Plumber'])).toBe(DEFAULT_HINT_EXAMPLE);
    expect(pickHintExample([])).toBe(DEFAULT_HINT_EXAMPLE);
  });
});
