import { useMemo } from 'react';
import type { Feed, SourceType } from '../../../preload/channels';
import { useArticleContent } from '../useArticleContent';
import type { RiverItem } from '../river/utils';
import { deriveStandfirst, findRawDescription, renderPlainTextDescription } from './reader';

interface ReaderContentStrategy {
  /** Whether the reader should ask main to fetch and extract the item's own link as a full article. */
  fetchesFullArticle: boolean;
  /** Turns the item's raw, unprocessed description into displayable HTML, shown while there is no fetched article. */
  renderDescription: (rawDescription: string) => string;
  /** Whether a short teaser paragraph shows above the body, ahead of the (usually longer) fetched article. */
  showStandfirst: boolean;
}

// One entry per SourceType. A new source type is a new entry here, never a new branch in Reader.tsx.
const STRATEGY_BY_TYPE: Record<SourceType, ReaderContentStrategy> = {
  rss: {
    fetchesFullArticle: true,
    renderDescription: (raw) => raw,
    showStandfirst: true,
  },
  youtube: {
    fetchesFullArticle: false,
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

/**
 * Resolves what the reader should show for the current item's body, entirely from the item's own
 * source type: whether to fetch and wait for a full extracted article, and how to render its raw
 * description otherwise. `Reader.tsx` renders the result without knowing what type it came from.
 * @param feeds every stored feed, searched for the item's raw (unstripped) description
 * @param item the item to show, or `undefined` while it has not resolved yet
 */
export function useReaderContent(feeds: Feed[], item: RiverItem | undefined): ReaderContent {
  const strategy = item ? STRATEGY_BY_TYPE[item.type] : undefined;
  const articleContent = useArticleContent(strategy?.fetchesFullArticle ? item?.id : undefined);
  const rawDescription = useMemo(() => (item ? findRawDescription(feeds, item.id) : undefined), [feeds, item]);

  const standfirst = useMemo(() => {
    if (!item || !strategy?.showStandfirst) {
      return undefined;
    }
    return deriveStandfirst(item.description);
  }, [item, strategy?.showStandfirst]);

  const html = useMemo(() => {
    if (articleContent.state === 'ready') {
      return articleContent.html;
    }
    return strategy?.renderDescription(rawDescription ?? '') ?? (rawDescription ?? '');
  }, [articleContent, strategy, rawDescription]);

  return {
    html,
    wordCount: articleContent.state === 'ready' ? articleContent.wordCount : undefined,
    standfirst,
    isLoading: !!strategy?.fetchesFullArticle && articleContent.state === 'loading',
    isUnavailable: !!strategy?.fetchesFullArticle && articleContent.state === 'unavailable',
  };
}
