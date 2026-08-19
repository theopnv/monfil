import { useEffect, useState } from 'react';

export type ArticleContentState =
  | { state: 'loading' }
  | { state: 'ready'; html: string; wordCount: number }
  | { state: 'unavailable' };

const loadingState: ArticleContentState = { state: 'loading' };
const unavailableState: ArticleContentState = { state: 'unavailable' };

/**
 * Resolves the full article body for an item over `items:get-content`, extracting on demand
 * when nothing was stored during refresh.
 * @param itemId the item to resolve, or `undefined` while no item is selected
 */
export function useArticleContent(itemId: number | undefined): ArticleContentState {
  const [state, setState] = useState<ArticleContentState>(loadingState);

  useEffect(() => {
    if (itemId === undefined) {
      setState(unavailableState);
      return;
    }

    let cancelled = false;
    setState(loadingState);

    window.electron.ipcRenderer
      .invoke('items:get-content', itemId)
      .then((result) => {
        if (cancelled) return;
        setState(result.status === 'ok' ? { state: 'ready', html: result.html, wordCount: result.wordCount } : unavailableState);
      })
      .catch(() => {
        if (cancelled) return;
        setState(unavailableState);
      });

    // Paging fast through items resolves responses out of order; drop any response whose
    // item is no longer the one this effect was started for.
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  return state;
}
