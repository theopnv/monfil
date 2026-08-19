import { useEffect, useMemo, useRef, useState } from "react";
import RiverSidebar from "@/components/Home/RiverSidebar";
import ArticleBody from "@/components/Reader/ArticleBody";
import ArticleHeroImage from "@/components/Reader/ArticleHeroImage";
import ArticleMeta from "@/components/Reader/ArticleMeta";
import ArticleSourceLink from "@/components/Reader/ArticleSourceLink";
import NextArticleCard from "@/components/Reader/NextArticleCard";
import ReaderHeader from "@/components/Reader/ReaderHeader";
import ReadingProgressBar from "@/components/common/ReadingProgressBar";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { deriveStandfirst, findRawDescription, getReaderNavigation } from "@/lib/reader";
import { toRiverItems } from "@/lib/river";
import { useArticleContent } from "@/lib/useArticleContent";
import { useFeeds, useReadState } from "@/providers/feeds-provider";

export interface ReaderProps {
  itemId: string;
  onNavigateToItem: (id: number) => void;
  onNavigateHome: () => void;
}

export default function Reader({ itemId, onNavigateToItem, onNavigateHome }: ReaderProps) {
  const id = Number(itemId);
  const feeds = useFeeds();
  const { isRead, markRead } = useReadState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const riverItems = useMemo(() => toRiverItems(feeds), [feeds]);
  const currentItem = useMemo(() => riverItems.find((item) => item.id === id), [riverItems, id]);
  const rawDescription = useMemo(() => findRawDescription(feeds, id), [feeds, id]);
  const navigation = useMemo(() => getReaderNavigation(riverItems, id, isRead), [riverItems, id, isRead]);
  const standfirst = useMemo(() => (currentItem ? deriveStandfirst(currentItem.description) : undefined), [currentItem]);
  const readerHighlightedLinks = useMemo(() => new Set(currentItem ? [currentItem.feedLink] : []), [currentItem]);
  const articleContent = useArticleContent(currentItem?.id);

  useEffect(() => {
    if (currentItem) {
      markRead(currentItem.id);
    }
    // Route reuse means this effect must re-run per article id, not once on mount.
  }, [currentItem?.id, markRead]);

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
  const nextLabel = nextTarget && !isRead(nextTarget.id) ? "Next unread" : "Next article";

  return (
    <div className="flex h-full w-full overflow-hidden">
      <RiverSidebar
        feeds={feeds}
        showOnlyLinks={readerHighlightedLinks}
        onSetVisibility={() => onNavigateHome()}
        onFeedDeleted={() => onNavigateHome()}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <ReadingProgressBar progress={progress} />
        <ReaderHeader
          item={currentItem}
          onNavigateHome={onNavigateHome}
          onPrevious={() => navigation.previous && onNavigateToItem(navigation.previous.id)}
          onNext={() => navigation.next && onNavigateToItem(navigation.next.id)}
          hasPrevious={!!navigation.previous}
          hasNext={!!navigation.next}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6.5 pb-25">
          <article className="mx-auto max-w-[700px] pt-11">
            <ArticleMeta item={currentItem} wordCount={articleContent.state === 'ready' ? articleContent.wordCount : undefined} />

            <h1 className="mb-4.5 text-4xl leading-tight text-pretty text-primary">{currentItem.title}</h1>

            {standfirst && <p className="mb-6.5 text-lg leading-relaxed text-pretty text-secondary">{standfirst}</p>}

            <ArticleHeroImage src={currentItem.image} />

            {articleContent.state === 'loading' && (
              <p className="mb-4 text-sm text-tertiary">Loading full article…</p>
            )}

            <ArticleBody html={articleContent.state === 'ready' ? articleContent.html : (rawDescription ?? '')} />

            {articleContent.state === 'unavailable' && (
              <p className="mb-4 text-sm text-tertiary">The full article could not be loaded. Read it at the source instead.</p>
            )}

            <ArticleSourceLink item={currentItem} />

            {nextTarget && <NextArticleCard item={nextTarget} label={nextLabel} onClick={() => onNavigateToItem(nextTarget.id)} />}
          </article>
        </div>
      </div>
    </div>
  );
}
