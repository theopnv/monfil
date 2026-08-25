import { useEffect, useState } from "react";

// Offsets the "active" line below the header, so a section's heading must clear it before stealing
// the active state from the section above.
const TOP_OFFSET_PX = 96;

/**
 * Tracks which of `sectionIds` is the active one while scrolling their shared ancestor (the nearest
 * `overflow-y-auto` element): the last section whose top has crossed `TOP_OFFSET_PX`, or the last
 * section outright once the container is scrolled to its bottom. The bottom clamp matters because
 * the last section's heading may never reach the top offset on its own — there is no content below
 * it to scroll further.
 */
export function useActiveSection(sectionIds: readonly string[]): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>(sectionIds[0]);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const firstElement = elements[0];
    if (!firstElement) {
      return;
    }

    const scrollContainer = firstElement.closest<HTMLElement>('.overflow-y-auto');
    if (!scrollContainer) {
      return;
    }

    const updateActiveId = () => {
      const scrolledToBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1;
      if (scrolledToBottom) {
        setActiveId(sectionIds[sectionIds.length - 1]);
        return;
      }

      const containerTop = scrollContainer.getBoundingClientRect().top;
      let current = firstElement;
      for (const element of elements) {
        if (element.getBoundingClientRect().top - containerTop <= TOP_OFFSET_PX) {
          current = element;
        }
      }
      setActiveId(current.id);
    };

    updateActiveId();
    scrollContainer.addEventListener('scroll', updateActiveId, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', updateActiveId);
  }, [sectionIds]);

  return activeId;
}
