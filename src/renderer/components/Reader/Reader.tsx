import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import RiverSidebar from "@/components/Home/RiverSidebar";
import ArticleBody from "@/components/Reader/ArticleBody";
import ArticleHeroImage from "@/components/Reader/ArticleHeroImage";
import ArticleMeta from "@/components/Reader/ArticleMeta";
import KeyboardShortcutsHint from "@/components/Reader/KeyboardShortcutsHint";
import NextArticleCard from "@/components/Reader/NextArticleCard";
import ReaderHeader from "@/components/Reader/ReaderHeader";
import ReadingProgressBar from "@/components/common/ReadingProgressBar";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { announce } from "@/lib/announcer";
import { queryKeys, mergeRiverRows } from "@/lib/queries";
import { getReaderNavigation } from "@/lib/reader/reader";
import { useReaderContent } from "@/lib/reader/useReaderContent";
import { useRiverScope } from "@/lib/river/useRiverScope";
import { useCategories, useFeeds, useReadState, useRiver } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { HOME_WORKSPACE_ID, type RiverPage } from "../../../preload/channels";

export interface ReaderProps {
  itemId: string;
  onNavigateToItem: (id: number) => void;
  onNavigateHome: () => void;
}

export default function Reader({ itemId, onNavigateToItem, onNavigateHome }: ReaderProps) {
  const id = Number(itemId);
  const feeds = useFeeds();
  const categories = useCategories();
  const { markRead, toggleRead } = useReadState();
  const { preferences } = usePreferences();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  // Shares Home's window and cache: same scope, same query key, so navigation follows whatever
  // Home is currently scoped to instead of maintaining its own separate view of the river.
  const { scope } = useRiverScope(feeds);
  const { data } = useRiver(scope);
  const riverItems = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);
  const currentItem = useMemo(() => riverItems.find((item) => item.id === id), [riverItems, id]);
  const isRead = useCallback((candidateId: number) => !!riverItems.find((item) => item.id === candidateId)?.readAt, [riverItems]);
  const navigation = useMemo(() => getReaderNavigation(riverItems, id, isRead), [riverItems, id, isRead]);
  const readerHighlightedLinks = useMemo(() => new Set(currentItem ? [currentItem.feedLink] : []), [currentItem]);
  const content = useReaderContent(currentItem);

  const mergeRows = useCallback((rows: RiverPage['rows']) => {
    if (rows.length === 0) {
      return;
    }
    queryClient.setQueryData<InfiniteData<RiverPage>>(queryKeys.river(scope), (current) => (current ? mergeRiverRows(current, rows) : current));
  }, [queryClient, scope]);

  // A deep link to an item outside the loaded window: fetch the exact row directly.
  useEffect(() => {
    if (currentItem || Number.isNaN(id)) {
      return;
    }
    let cancelled = false;
    window.electron.ipcRenderer.invoke('items:query', { workspaceId: HOME_WORKSPACE_ID, ids: [id], limit: 1 })
      .then((page) => {
        if (!cancelled) {
          mergeRows(page.rows);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentItem, id, mergeRows]);

  // `nextUnread` found nothing locally: ask main for the next unread row past this one's cursor.
  useEffect(() => {
    if (!currentItem || navigation.nextUnread) {
      return;
    }
    let cancelled = false;
    window.electron.ipcRenderer
      .invoke('items:query', { ...scope, unreadOnly: true, cursor: { publishedAt: currentItem.publishedAt, id: currentItem.id }, limit: 1 })
      .then((page) => {
        if (!cancelled) {
          mergeRows(page.rows);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentItem, navigation.nextUnread, scope, mergeRows]);

  useEffect(() => {
    if (currentItem) {
      markRead(currentItem.id);
    }
    // Route reuse means this effect must re-run per article id, not once on mount.
  }, [currentItem?.id, markRead]);

  useEffect(() => {
    if (!preferences.keyboardNavigation) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onNavigateHome();
      } else if (event.key === "j" && navigation.next) {
        onNavigateToItem(navigation.next.id);
      } else if (event.key === "k" && navigation.previous) {
        onNavigateToItem(navigation.previous.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNavigateHome, onNavigateToItem, navigation.next, navigation.previous, preferences.keyboardNavigation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    el.scrollTop = 0;
    setProgress(0);

    const handleScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [currentItem?.id]);

  if (!currentItem) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-tertiary">This article could not be found.</p>
          <Button color="secondary" onPress={onNavigateHome}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const nextTarget = navigation.nextUnread;
  const nextLabel = nextTarget && !nextTarget.readAt ? "Next unread" : "Next article";

  const handleToggleRead = () => {
    const willBeRead = !currentItem.readAt;
    toggleRead(currentItem.id, !!currentItem.readAt);
    announce(willBeRead ? "Marked as read" : "Marked as unread");
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <RiverSidebar
        feeds={feeds}
        categories={categories}
        showOnlyLinks={readerHighlightedLinks}
        onSetVisibility={() => onNavigateHome()}
        onFeedDeleted={() => onNavigateHome()}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <ReadingProgressBar progress={progress} />
        <ReaderHeader
          item={currentItem}
          onNavigateHome={onNavigateHome}
          onToggleRead={handleToggleRead}
          onPrevious={() => navigation.previous && onNavigateToItem(navigation.previous.id)}
          onNext={() => navigation.next && onNavigateToItem(navigation.next.id)}
          hasPrevious={!!navigation.previous}
          hasNext={!!navigation.next}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6.5 pb-25">
          <article className="mx-auto max-w-[700px] pt-11">
            <ArticleMeta item={currentItem} wordCount={content.wordCount} />

            <h1 className="mb-4.5 text-4xl leading-tight text-pretty text-primary">{currentItem.title}</h1>

            {content.standfirst && <p className="mb-6.5 text-lg leading-relaxed text-pretty text-secondary">{content.standfirst}</p>}

            <ArticleHeroImage src={currentItem.image} />

            {content.isLoading && (
              <p className="mb-4 text-sm text-tertiary">Loading full article…</p>
            )}

            <ArticleBody html={content.html} />

            {content.isUnavailable && (
              <p className="mb-4 text-sm text-tertiary">The full article could not be loaded. Read it at the source instead.</p>
            )}

            {nextTarget && <NextArticleCard item={nextTarget} label={nextLabel} onClick={() => onNavigateToItem(nextTarget.id)} />}

            {preferences.keyboardNavigation && <KeyboardShortcutsHint />}
          </article>
        </div>
      </div>
    </div>
  );
}
