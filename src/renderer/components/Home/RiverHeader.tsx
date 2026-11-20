// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useRef, type ReactNode } from "react";
import { RefreshCw01 } from "@untitledui/icons";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import RiverFilterStrip from "@/components/Home/RiverFilterStrip";
import RiverSearch from "@/components/Home/RiverSearch";
import { cx } from "@/components/untitled-ui/utils/cx";
import { announce } from "@/lib/announcer";
import { useApplyPendingRefresh, useHasPendingRefresh } from "@/lib/push-events";
import { useFeedsRefresh } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { useActiveWorkspace } from "@/providers/workspace-provider";
import type { FeedSummary } from "../../../shared/contracts";

const READ_FILTER_IDS = ["all", "unread"] as const;

function ReadFilter({ unreadOnly, onChange }: { unreadOnly: boolean; onChange: (unreadOnly: boolean) => void }) {
  const { t } = useTranslation('river');
  return (
    <ToggleButtonGroup
      aria-label={t('header.itemsToShow')}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[unreadOnly ? "unread" : "all"]}
      onSelectionChange={(keys) => onChange(keys.has("unread"))}
      className="flex flex-none rounded-full bg-secondary p-0.5 ring-1 ring-secondary ring-inset"
    >
      {READ_FILTER_IDS.map((id) => (
        <ToggleButton
          key={id}
          id={id}
          className={({ isSelected }) => cx(
            "rounded-full px-3.5 py-1.5 text-sm font-semibold outline-brand transition duration-100 ease-linear focus-visible:outline-2",
            isSelected ? "bg-primary text-secondary shadow-xs" : "text-quaternary hover:text-tertiary",
          )}
        >
          {t(`header.${id}`)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export interface RiverHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hasFeeds: boolean;
  /** The feeds the river shows, so the Refresh pill only appears for items that will land in it. */
  visibleFeedIds: ReadonlySet<number>;
  onPendingApplied?: () => void;
  savedView?: boolean;
  feeds: FeedSummary[];
  showOnlyLinks: ReadonlySet<string>;
  onClearFocus: () => void;
  onShowHidden: (feedIds: number[]) => void;
  searchActions?: ReactNode;
}

export default function RiverHeader({ searchQuery, onSearchChange, hasFeeds, visibleFeedIds, onPendingApplied, savedView = false, feeds, showOnlyLinks, onClearFocus, onShowHidden, searchActions }: RiverHeaderProps) {
  const { t } = useTranslation('river');
  const { refreshNow, isRefreshing, refreshFailed } = useFeedsRefresh();
  const { preferences, setPreference } = usePreferences();
  const activeWorkspace = useActiveWorkspace();
  const hasPendingRefresh = useHasPendingRefresh(visibleFeedIds) && !savedView && !isRefreshing;
  const applyPendingRefresh = useApplyPendingRefresh();

  const handlePendingClick = () => {
    applyPendingRefresh();
    onPendingApplied?.();
  };

  const hadPendingRefresh = useRef(false);
  useEffect(() => {
    if (hasPendingRefresh && !hadPendingRefresh.current) {
      announce(t('header.announceNew'));
    }
    hadPendingRefresh.current = hasPendingRefresh;
  }, [hasPendingRefresh, t]);

  const wasRefreshing = useRef(false);
  useEffect(() => {
    if (wasRefreshing.current && !isRefreshing) {
      announce(refreshFailed ? t('header.refreshFailed') : t('header.announceRefreshed'));
    }
    wasRefreshing.current = isRefreshing;
  }, [isRefreshing, refreshFailed, t]);

  const heading = savedView ? t('header.saved') : activeWorkspace?.name ?? t('header.home');
  return (
    <header className="flex flex-none flex-col border-b border-secondary px-8.5 py-4.5">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-2">
        <div className="flex items-end gap-5">
          <div className="min-w-0 flex-1">
            {savedView && <div className="mb-1 text-xs font-semibold tracking-wide text-brand-secondary uppercase">{activeWorkspace?.name ?? t('header.home')}</div>}
            <h1 className="truncate font-display text-display-md leading-tight text-primary" title={heading}>{heading}</h1>
          </div>

          {(hasFeeds || savedView) && (
            <div className="flex flex-none items-center justify-end gap-2.5">
              <RiverSearch
                value={searchQuery}
                onChange={onSearchChange}
                placeholder={savedView ? t('header.searchSaved') : t('header.search')}
                saveControl={searchActions}
              />
              {!savedView && <ReadFilter unreadOnly={preferences.hideReadItems} onChange={(unreadOnly) => setPreference("hideReadItems", unreadOnly)} />}
              {hasPendingRefresh && <Button
                aria-label={t('header.refreshNew')}
                color="primary"
                iconLeading={RefreshCw01}
                className="flex-none rounded-full"
                onPress={handlePendingClick}
              >
                {t('header.refresh')}
              </Button>}
              {!savedView && !hasPendingRefresh && <Button
                aria-label={t('header.refreshFeeds')}
                color="secondary"
                iconLeading={RefreshCw01}
                className="flex-none rounded-full"
                isLoading={isRefreshing}
                isDisabled={isRefreshing}
                onPress={refreshNow}
              />}
            </div>
          )}
        </div>

        {!savedView && <RiverFilterStrip feeds={feeds} showOnlyLinks={showOnlyLinks} onClearFocus={onClearFocus} onShowHidden={onShowHidden} />}

        {!savedView && hasFeeds && refreshFailed && <p className="text-end text-sm text-error-primary">{t('header.refreshFailed')}</p>}
      </div>
    </header>
  );
}
