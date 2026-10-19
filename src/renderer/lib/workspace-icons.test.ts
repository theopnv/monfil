// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Rss01 } from '@untitledui/icons';
import { describe, expect, test } from 'vitest';
import { WORKSPACE_COLORS, WORKSPACE_ICONS, workspaceIconComponent } from './workspace-icons';

describe('workspaceIconComponent', () => {
  test.each(WORKSPACE_ICONS.filter((icon) => icon !== 'Rss01'))('resolves the picker icon %s to its own component', (icon) => {
    // Act
    const component = workspaceIconComponent(icon);

    // Assert
    expect(component).not.toBe(Rss01);
  });

  test('falls back to Rss01 for an unknown name', () => {
    // Act
    const component = workspaceIconComponent('NotAnIcon');

    // Assert
    expect(component).toBe(Rss01);
  });
});

describe('workspace picker options', () => {
  test('lists each icon and colour once', () => {
    // Assert
    expect(new Set(WORKSPACE_ICONS).size).toBe(WORKSPACE_ICONS.length);
    expect(new Set(WORKSPACE_COLORS).size).toBe(WORKSPACE_COLORS.length);
  });
});
