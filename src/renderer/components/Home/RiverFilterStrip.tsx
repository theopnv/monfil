// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { announce } from "@/lib/announcer";
import { feedVisibility } from "@/lib/river/feed-visibility";
import type { FeedSummary } from "../../../shared/contracts";

export interface RiverFilterStripProps {
  feeds: FeedSummary[];
  showOnlyLinks: ReadonlySet<string>;
  /** Clears the focus of the active workspace. */
  onClearFocus: () => void;
  /** Shows the given hidden feeds in the active workspace again. */
  onShowHidden: (feedIds: number[]) => void;
}

function StripAction({ label, children, onPress }: { label: string; children: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className="cursor-pointer rounded-sm font-semibold text-brand-secondary outline-brand hover:underline focus-visible:outline-2"
    >
      {children}
    </button>
  );
}

/** Says why the river shows fewer feeds than the sidebar lists, with one way back for each cause. */
export default function RiverFilterStrip({ feeds, showOnlyLinks, onClearFocus, onShowHidden }: RiverFilterStripProps) {
  const { t } = useTranslation('river');
  const shown = feeds.filter((feed) => feed.showInWorkspace !== 0);
  const focusedCount = shown.filter((feed) => feedVisibility(feed, showOnlyLinks) === "only").length;
  const hiddenIds = feeds.filter((feed) => feed.showInWorkspace === 0).map((feed) => feed.id);

  if (focusedCount === 0 && hiddenIds.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-tertiary">
      {focusedCount > 0 && (
        <p className="flex items-center gap-2">
          <span>{t('strip.focused', { focused: focusedCount, count: shown.length })}</span>
          <StripAction
            label={t('strip.showAllLabel')}
            onPress={() => {
              onClearFocus();
              announce(t('strip.showAnnounce'));
            }}
          >
            {t('strip.showAll')}
          </StripAction>
        </p>
      )}
      {hiddenIds.length > 0 && (
        <p className="flex items-center gap-2">
          <span>{t('strip.hidden', { count: hiddenIds.length })}</span>
          <StripAction
            label={t('strip.showHiddenLabel')}
            onPress={() => {
              onShowHidden(hiddenIds);
              announce(t('strip.hiddenAnnounce'));
            }}
          >
            {t('strip.showHidden')}
          </StripAction>
        </p>
      )}
    </div>
  );
}
