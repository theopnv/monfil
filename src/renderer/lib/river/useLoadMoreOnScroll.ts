import { useEffect, type RefObject } from 'react';

const NEAR_BOTTOM_PX = 600;

/**
 * Calls `loadMore` once the scroll container is within `NEAR_BOTTOM_PX` of its bottom, and once on
 * mount, since a window shorter than the viewport never fires a scroll event at all.
 */
export function useLoadMoreOnScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  loadMore: () => void,
  canLoadMore: boolean,
): void {
  useEffect(() => {
    if (!canLoadMore) {
      return;
    }
    const root = scrollRef.current;
    if (!root) {
      return;
    }

    const maybeLoadMore = () => {
      const distanceToBottom = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (distanceToBottom <= NEAR_BOTTOM_PX) {
        loadMore();
      }
    };

    maybeLoadMore();

    root.addEventListener('scroll', maybeLoadMore, { passive: true });
    return () => root.removeEventListener('scroll', maybeLoadMore);
  }, [scrollRef, loadMore, canLoadMore]);
}
