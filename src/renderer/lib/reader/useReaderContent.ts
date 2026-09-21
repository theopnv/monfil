import { useEffect, useMemo, useState } from 'react';
import type { ItemBody, RiverRow, SourceType } from '../../../shared/contracts';
import { deriveStandfirst, renderPlainTextDescription } from './reader';

interface ReaderContentStrategy {
  /** Turns the item's raw description into displayable HTML, shown while there is no fetched article. */
  renderDescription: (rawDescription: string) => string;
  // Also stands in for "this source fetches a full article": both happen to coincide for every
  // source type today, and only the main-only registry otherwise knows the latter.
  showStandfirst: boolean;
}

// One entry per SourceType. A new source type is a new entry here, never a new branch in Reader.tsx.
const STRATEGY_BY_TYPE: Record<SourceType, ReaderContentStrategy> = {
  rss: {
    renderDescription: (raw) => raw,
    showStandfirst: true,
  },
  youtube: {
    renderDescription: renderPlainTextDescription,
    showStandfirst: false,
  },
};

export interface ReaderContent {
  html: string;
  wordCount: number | undefined;
  standfirst: string | undefined;
  isLoading: boolean;
  isUnavailable: boolean;
}

type BodyState =
  | { state: 'loading' }
  | { state: 'ready'; body: ItemBody }
  | { state: 'unavailable' };

/**
 * Resolves what the reader should show for the current item's body: the raw description and,
 * for sources the registry marks as fetching full articles, the extracted article, in one call.
 * @param item the item to show, or `undefined` while it has not resolved yet
 */
export function useReaderContent(item: RiverRow | undefined): ReaderContent {
  const [body, setBody] = useState<BodyState>({ state: 'loading' });
  const itemId = item?.id;

  useEffect(() => {
    if (itemId === undefined) {
      setBody({ state: 'unavailable' });
      return;
    }

    let cancelled = false;
    setBody({ state: 'loading' });

    window.electron.ipcRenderer
      .invoke('items:get-content', itemId)
      .then((result) => {
        if (!cancelled) {
          setBody({ state: 'ready', body: result });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBody({ state: 'unavailable' });
        }
      });

    // Paging fast through items resolves responses out of order; drop any response whose
    // item is no longer the one this effect was started for.
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const strategy = item ? STRATEGY_BY_TYPE[item.type] : undefined;

  const standfirst = useMemo(() => {
    if (!item || !strategy?.showStandfirst) {
      return undefined;
    }
    return deriveStandfirst(item.excerpt);
  }, [item, strategy?.showStandfirst]);

  const description = body.state === 'ready' ? body.body.description : '';
  const article = body.state === 'ready' ? body.body.article : undefined;

  const html = useMemo(() => {
    if (article) {
      return article.html;
    }
    return strategy?.renderDescription(description) ?? description;
  }, [article, strategy, description]);

  return {
    html,
    wordCount: article?.wordCount,
    standfirst,
    isLoading: !!strategy?.showStandfirst && body.state === 'loading',
    isUnavailable: !!strategy?.showStandfirst && body.state === 'ready' && !article,
  };
}
