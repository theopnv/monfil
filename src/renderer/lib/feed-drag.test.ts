// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { decodeFeedDrag, encodeFeedDrag } from './feed-drag';

describe('feed drag payload', () => {
  test('decodes what it encoded', () => {
    // Arrange
    const payload = { feedId: 3, workspaceId: 2, categoryName: 'Tech' };

    // Act
    const decoded = decodeFeedDrag(encodeFeedDrag(payload));

    // Assert
    expect(decoded).toEqual(payload);
  });

  test.each([
    ['text that is not JSON', 'not json'],
    ['JSON that is not an object', '42'],
    ['null', 'null'],
    ['an object missing a field', '{"feedId":1,"workspaceId":2}'],
    ['an object with a wrong field type', '{"feedId":"1","workspaceId":2,"categoryName":"Tech"}'],
  ])('rejects %s', (_label, text) => {
    // Act
    const decoded = decodeFeedDrag(text);

    // Assert
    expect(decoded).toBeNull();
  });
});
