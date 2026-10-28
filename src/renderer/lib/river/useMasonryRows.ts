// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useLayoutEffect, type RefObject } from 'react';

/**
 * Packs the children of a CSS grid into a masonry layout while keeping them in DOM order, so
 * keyboard navigation and screen readers still follow the river order. The container must use
 * 1px auto rows with no row gap; its column gap is reused as the vertical gap. Each child must
 * align to the start of its area so its height stays driven by its own content.
 */
export function useMasonryRows(containerRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  // A layout effect sizes the rows before the router restores the river's scroll position, which a 1px-tall grid would clamp to 0.
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0;
    const children = () => [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement);

    const sizeRow = (child: HTMLElement) => {
      child.style.gridRowEnd = `span ${Math.ceil(child.getBoundingClientRect().height + gap)}`;
    };
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sizeRow(entry.target as HTMLElement);
      }
    });
    const observeAll = () => {
      for (const child of children()) {
        resizeObserver.observe(child);
      }
    };
    const mutationObserver = new MutationObserver(observeAll);

    children().forEach(sizeRow);
    observeAll();
    mutationObserver.observe(container, { childList: true });

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      for (const child of children()) {
        child.style.gridRowEnd = '';
      }
    };
  }, [containerRef, enabled]);
}
