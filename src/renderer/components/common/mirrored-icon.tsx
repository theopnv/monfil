// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ComponentType, FC } from 'react';
import { cx } from '@/components/untitled-ui/utils/cx';

/**
 * Wraps an icon that points along the reading direction, such as a back arrow, so it flips in right-to-left layouts.
 * Call it once at module level: the wrapper is a component and must keep its identity between renders.
 */
export function mirrored(Icon: ComponentType<{ className?: string }>): FC<{ className?: string }> {
  return function MirroredIcon({ className }) {
    return <Icon className={cx(className, 'rtl:-scale-x-100')} />;
  };
}
