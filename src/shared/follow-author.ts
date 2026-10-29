// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

// The preload project also compiles src/shared and has no DOM types, so these describe only the DOM parts in use.
interface FollowListBox {
  matches(selectors: string): boolean;
  remove(): void;
}

interface FollowList {
  readonly parentElement: FollowListBox | null;
  remove(): void;
}

interface FollowControl {
  closest(selectors: string): FollowList | null;
}

interface ParsedPage {
  querySelectorAll(selectors: string): ArrayLike<FollowControl>;
}

/**
 * Removes the follow-author list that some sites put in an article, with the box around it,
 * unless that box is the page or the article itself.
 * @param document the parsed page or article to clean in place
 */
export function removeFollowAuthorControls(document: ParsedPage): void {
  for (const control of Array.from(document.querySelectorAll('[id^="follow-author-article_footer"]'))) {
    const list = control.closest('ul');
    const container = list?.parentElement;
    (container && !container.matches('body, article, main') ? container : list)?.remove();
  }
}
