import { useEffect, type RefObject } from 'react';

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * j/k move focus between `[data-item-id]` cards inside `containerRef`, so Enter
 * (already handled by each card's own key handler) opens whichever one is focused.
 */
export function useRiverKeyboardNav(containerRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'j' && event.key !== 'k') {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const cards = [...container.querySelectorAll<HTMLElement>('[data-item-id]')];
      if (cards.length === 0) {
        return;
      }
      const activeIndex = cards.findIndex((card) => card === document.activeElement);
      const nextIndex = event.key === 'j'
        ? Math.min(activeIndex + 1, cards.length - 1)
        : (activeIndex === -1 ? 0 : Math.max(activeIndex - 1, 0));

      cards[nextIndex]?.focus();
      cards[nextIndex]?.scrollIntoView({ block: 'nearest' });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, enabled]);
}
