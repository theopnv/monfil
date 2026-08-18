import { useEffect, type RefObject } from 'react';

const FLUSH_DELAY_MS = 300;

/**
 * Marks an item read once its card has scrolled entirely above the visible area of `scrollRef`.
 * Cards are found by `[data-item-id]` within the scroll container; a `MutationObserver` picks up
 * cards that render after the initial scan (a refresh, a filter change). Ids are buffered and
 * flushed on a short timeout, so a fast scroll sends one `markAllRead` call rather than dozens.
 */
export function useMarkReadOnScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  markAllRead: (ids: number[]) => void,
): void {
  useEffect(() => {
    if (!enabled) return;
    const root = scrollRef.current;
    if (!root) return;

    const pendingIds = new Set<number>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (pendingIds.size === 0) return;
      markAllRead([...pendingIds]);
      pendingIds.clear();
    };

    const intersectionObserver = new IntersectionObserver((entries) => {
      let scheduled = false;
      for (const entry of entries) {
        const passedAbove = entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0);
        if (!passedAbove) continue;
        const idAttr = (entry.target as HTMLElement).dataset['itemId'];
        if (!idAttr) continue;
        pendingIds.add(Number(idAttr));
        scheduled = true;
      }
      if (scheduled) {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
      }
    }, { root });

    const observeExisting = () => {
      root.querySelectorAll<HTMLElement>('[data-item-id]').forEach((element) => intersectionObserver.observe(element));
    };
    observeExisting();

    const mutationObserver = new MutationObserver(observeExisting);
    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
      clearTimeout(flushTimer);
      flush();
    };
  }, [scrollRef, enabled, markAllRead]);
}
