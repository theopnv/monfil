// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { SearchLg } from '@untitledui/icons';
import { Button } from '@/components/untitled-ui/base/buttons/button';
import { useFeedpackCatalog, useFeedpackPreview } from '@/providers/feedpacks-provider';
import type { Feedpack } from '../../../shared/contracts';
import type { FeedpackPreview } from '../../../shared/contracts';

export interface FeedpackBrowserProps {
  isActive: boolean;
  selected: FeedpackPreview | null;
  onSelect: (selection: FeedpackPreview) => void;
}

function matchesQuery(pack: Feedpack, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [pack.title, pack.description, pack.curator, ...pack.tags].join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export default function FeedpackBrowser({ isActive, selected, onSelect }: FeedpackBrowserProps) {
  const { t } = useTranslation('workspace');
  const catalog = useFeedpackCatalog(isActive);
  const preview = useFeedpackPreview();
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isActive) {
      setError(null);
      setQuery('');
    }
  }, [isActive]);

  async function showPack(pack: Feedpack) {
    setIsLoadingPreview(true);
    setError(null);
    const result = await preview(pack.slug);
    setIsLoadingPreview(false);
    if (result.success) {
      onSelect(result.data);
    } else {
      setError(result.error.message);
    }
  }

  const catalogError = catalog.data && !catalog.data.success ? catalog.data.error.message : null;
  const packs = catalog.data?.success ? catalog.data.data.packs : [];
  const visiblePacks = packs.filter((pack) => matchesQuery(pack, query));

  if (selected) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4.5">
        <div className="flex flex-col gap-1.5 pb-4">
          <h3 className="font-medium text-primary">{selected.pack.title}</h3>
          <p className="text-sm text-tertiary">{selected.pack.description}</p>
          <p className="text-sm text-secondary">{t('feedpacks.sources', { count: selected.sources.categories.reduce((total, category) => total + category.feeds.length, 0) })}</p>
        </div>

        <ul aria-label={t('feedpacks.packSources')} className="flex flex-col gap-3 border-s border-secondary ps-4">
          {selected.sources.categories.map((category) => (
            <li key={category.name}>
              <p className="text-sm font-semibold text-primary">{category.name}</p>
              <ul className="mt-1 flex flex-col gap-1 border-s border-secondary ps-3 text-sm text-tertiary">
                {category.feeds.map((feed) => <li key={feed.xmlUrl}>{feed.title}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-2">
          <SearchLg aria-hidden className="size-4 flex-none text-tertiary" />
          <input
            type="search"
            aria-label={t('feedpacks.search')}
            placeholder={t('feedpacks.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4.5">
        <div className="flex flex-col gap-2">
          {catalog.isPending && <p className="text-sm text-tertiary">{t('feedpacks.loading')}</p>}
          {(catalogError ?? error) && <p className="text-sm text-error-primary">{catalogError ?? error}</p>}
          {catalog.data?.success && packs.length === 0 && <p className="text-sm text-tertiary">{t('feedpacks.none')}</p>}
          {packs.length > 0 && visiblePacks.length === 0 && <p className="text-sm text-tertiary">{t('feedpacks.noMatch', { query: query.trim() })}</p>}
          {visiblePacks.map((pack) => (
            <Button key={pack.slug} color="secondary" size="md" className="h-auto justify-start py-3 text-start" onPress={() => void showPack(pack)}>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="min-w-0 truncate font-medium">{pack.title}</span>
                  <span className="flex-none text-tertiary">{t('feedpacks.sources', { count: pack.sourceCount })}</span>
                </span>
                <span className="whitespace-normal break-words text-tertiary">{pack.description}</span>
              </span>
            </Button>
          ))}
          {isLoadingPreview && <p className="text-sm text-tertiary">{t('feedpacks.loadingSources')}</p>}
        </div>
      </div>
    </div>
  );
}
