// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { translateErrorWithDetails } from "@/lib/error-text";
import { Link02 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import FeedMatchCard from "./FeedMatchCard";
import { isComposing } from "@/lib/keyboard";
import type { FeedValidationStatus } from "./useFeedValidation";
import type { TFunction } from "i18next";
import type { ParsedSource, FeedFetchError, SourceType } from "../../../shared/contracts";

export type FeedType = SourceType | undefined;

const KINDS: { id: FeedType; label: string | undefined; labelKey?: "find.kind.anything" | "find.kind.conferences" | "find.kind.jobs" }[] = [
  { id: undefined, label: undefined, labelKey: "find.kind.anything" },
  { id: "rss", label: "RSS" },
  { id: "youtube", label: "YouTube" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "hackernews", label: "Hacker News" },
  { id: "arxiv", label: "arXiv" },
  { id: "bluesky", label: "Bluesky" },
  { id: "mastodon", label: "Mastodon" },
  { id: "conference", label: undefined, labelKey: "find.kind.conferences" },
  { id: "ats", label: undefined, labelKey: "find.kind.jobs" },
];

function LinkIcon({ className }: { className?: string | undefined }) {
  return <Link02 className={className} />;
}

export interface Step1FindProps {
  query: string;
  onQueryChange: (query: string) => void;
  onValidate: () => void;
  type: FeedType;
  onTypeChange: (type: FeedType) => void;
  status: FeedValidationStatus;
  candidates: ParsedSource[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  error: FeedFetchError | null;
}

function candidateDetail(feed: ParsedSource, t: TFunction<"addFeed">): string {
  if (feed.type === "conference" && feed.items.length === 0) {
    return t("find.conferenceEmpty");
  }
  return t("find.detail", { link: feed.link, count: feed.items.length });
}

export default function Step1Find({ query, onQueryChange, onValidate, type, onTypeChange, status, candidates, selectedIndex, onSelect, error }: Step1FindProps) {
  const { t } = useTranslation('addFeed');
  const { t: tErrors } = useTranslation('errors');
  const feed = candidates[selectedIndex] ?? null;
  const kind = type ?? "anything";

  return (
    <div className="flex flex-col gap-1 px-7.5 py-5.5">
      <Input
        aria-label={t('find.feedUrl')}
        size="lg"
        icon={LinkIcon}
        placeholder={t(`find.copy.${kind}.placeholder`)}
        value={query}
        onChange={onQueryChange}
        onBlur={onValidate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !isComposing(event.nativeEvent)) {
            event.preventDefault();
            onValidate();
          }
        }}
        wrapperClassName="rounded-full"
      />
      <p className="mb-4.5 px-1.5 text-xs text-tertiary text-pretty">{t(`find.copy.${kind}.hint`)}</p>

      <div className="mb-5.5 flex flex-wrap gap-0.5 self-start rounded-3xl bg-primary_hover p-0.75">
        {KINDS.map((option) => (
          <Button
            key={option.id ?? "anything"}
            size="sm"
            color={option.id === type ? "secondary" : "tertiary"}
            className="rounded-full"
            onPress={() => onTypeChange(option.id)}
          >
            {option.label ?? (option.labelKey && t(option.labelKey))}
          </Button>
        ))}
      </div>

      {status === "loading" && <FeedMatchCard title={t('find.searching')} detail={query} status="loading" />}
      {status === "found" && candidates.length === 1 && feed && (
        <FeedMatchCard
          title={feed.title || feed.link}
          detail={candidateDetail(feed, t)}
          status="found"
          faviconUrl={feed.icon}
        />
      )}
      {status === "found" && candidates.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 px-1.5 text-xs text-tertiary">{t('find.candidates', { count: candidates.length })}</legend>
          {candidates.map((candidate, index) => (
            <label key={candidate.link} className="block cursor-pointer rounded-xl has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring">
              <input
                type="radio"
                name="feed-candidate"
                className="sr-only"
                checked={index === selectedIndex}
                onChange={() => onSelect(index)}
              />
              <FeedMatchCard
                title={candidate.label ? `${candidate.label} · ${candidate.title || candidate.link}` : candidate.title || candidate.link}
                detail={candidateDetail(candidate, t)}
                status="found"
                selected={index === selectedIndex}
                faviconUrl={candidate.icon}
              />
            </label>
          ))}
        </fieldset>
      )}
      {status === "not-found" && (
        <FeedMatchCard title={t('find.notFound')} detail={error ? translateErrorWithDetails(tErrors, error) : t('find.notFoundDetail')} status="not-found" />
      )}
    </div>
  );
}
