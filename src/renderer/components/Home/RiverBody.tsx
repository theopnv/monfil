// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import EmptyRiver from '@/components/Home/EmptyRiver';
import RiverList from '@/components/Home/RiverList';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import type { RiverRow } from '../../../shared/contracts';
import type { Density } from '@/lib/preferences';

export type RiverView =
  | 'saved-loading' | 'saved-failed' | 'saved-empty'
  | 'feedpack-fetching' | 'waiting' | 'empty-river'
  | 'no-results' | 'caught-up' | 'list';

interface RiverViewState {
  savedView: boolean;
  isPending: boolean;
  isError: boolean;
  isFeedpackRefreshing: boolean;
  awaitingFeeds: boolean;
  hasFeeds: boolean;
  hasSearch: boolean;
  hasItems: boolean;
  unreadCount: number;
}

function searchView(state: RiverViewState): RiverView {
  return state.hasItems ? 'list' : 'no-results';
}

function savedRiverView(state: RiverViewState): RiverView {
  if (state.isPending) {
    return 'saved-loading';
  }
  if (state.isError) {
    return 'saved-failed';
  }
  if (state.hasSearch) {
    return searchView(state);
  }
  return state.hasItems ? 'list' : 'saved-empty';
}

function homeRiverView(state: RiverViewState): RiverView {
  if (state.isFeedpackRefreshing) {
    return 'feedpack-fetching';
  }
  if (state.awaitingFeeds) {
    return 'waiting';
  }
  if (!state.hasFeeds) {
    return 'empty-river';
  }
  if (state.hasSearch) {
    return searchView(state);
  }
  return state.unreadCount === 0 ? 'caught-up' : 'list';
}

/** What the river area shows. The first state that applies wins. */
export function riverView(state: RiverViewState): RiverView {
  return state.savedView ? savedRiverView(state) : homeRiverView(state);
}

interface RiverBodyProps {
  view: RiverView;
  items: RiverRow[];
  density: Density;
  searchQuery: string;
  onOpen: (id: number) => void;
  onRetry: () => void;
  onImportOpml: () => void;
  onImportFeedpack: () => void;
}

export default function RiverBody({ view, items, density, searchQuery, onOpen, onRetry, onImportOpml, onImportFeedpack }: RiverBodyProps) {
  const { t } = useTranslation(['river', 'common']);
  switch (view) {
    case 'saved-loading':
      return <p className="py-20 text-center text-tertiary">{t('river:saved.loading')}</p>;
    case 'saved-failed':
      return (
        <div className="py-20 text-center">
          <p className="mb-3 text-tertiary">{t('river:saved.loadFailed')}</p>
          <Button color="secondary" onPress={onRetry}>{t('common:action.tryAgain')}</Button>
        </div>
      );
    case 'saved-empty':
      return <p className="py-20 text-center text-md text-tertiary">{t('river:saved.empty')}</p>;
    case 'feedpack-fetching':
      return <p className="py-20 text-center text-md font-regular text-tertiary">{t('river:feedpackFetching')}</p>;
    case 'waiting':
      return null;
    case 'empty-river':
      return <EmptyRiver onImportOpml={onImportOpml} onImportFeedpack={onImportFeedpack} />;
    case 'no-results':
      return <p className="py-20 text-center text-md font-regular text-tertiary">{t('river:results.none', { query: searchQuery })}</p>;
    case 'caught-up':
      return <p className="py-20 text-center text-md font-regular text-tertiary">{t('river:caughtUp')}</p>;
    case 'list':
      return <RiverList items={items} density={density} onOpen={onOpen} />;
  }
}
