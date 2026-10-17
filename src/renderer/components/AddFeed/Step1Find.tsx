// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Link02 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import { resolveFeedIcon } from "@/lib/favicon";
import FeedMatchCard from "./FeedMatchCard";
import type { FeedValidationStatus } from "./useFeedValidation";
import type { ParsedSource, FeedFetchError, SourceType } from "../../../shared/contracts";

export type FeedType = SourceType | undefined;

const KINDS: { id: FeedType; label: string }[] = [
  { id: undefined, label: "Anything" },
  { id: "rss", label: "RSS" },
  { id: "youtube", label: "YouTube" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "hackernews", label: "Hacker News" },
  { id: "arxiv", label: "arXiv" },
  { id: "bluesky", label: "Bluesky" },
  { id: "mastodon", label: "Mastodon" },
];

const COPY: Record<"anything" | SourceType, { placeholder: string; hint: string }> = {
  anything: {
    placeholder: "Paste a link to a website, feed, repository, or profile…",
    hint: "Monfil finds the feed behind the link. For a handle, press Enter.",
  },
  rss: {
    placeholder: "Paste a link to an RSS feed…",
    hint: "Monfil checks the link for an RSS feed.",
  },
  youtube: {
    placeholder: "Paste a channel, handle, or video link…",
    hint: "Paste a link, or enter a channel or handle and press Enter.",
  },
  github: {
    placeholder: "Paste a repository or user link, or owner/repo…",
    hint: "A repository gives its releases. A user or org gives its public activity. After owner/repo, press Enter.",
  },
  gitlab: {
    placeholder: "Paste a GitLab project link…",
    hint: "Monfil follows the project's releases. Self-hosted GitLab works too.",
  },
  hackernews: {
    placeholder: "Paste a Hacker News link…",
    hint: "news.ycombinator.com offers the front page and feeds filtered by points.",
  },
  arxiv: {
    placeholder: "Paste an arXiv listing link…",
    hint: "For example arxiv.org/list/cs.AI/recent. Monfil hides replaced papers.",
  },
  bluesky: {
    placeholder: "Paste a profile link or handle…",
    hint: "Enter a handle such as @name.bsky.social and press Enter.",
  },
  mastodon: {
    placeholder: "Paste a profile or tag link, or @user@host…",
    hint: "Enter a handle such as @user@mastodon.social and press Enter.",
  },
};

// Input's `icon` prop is typed as ComponentType<HTMLAttributes<HTMLOrSVGElement>>,
// but @untitledui/icons components are typed against SVGProps. InputBase only
// ever passes `className`, so this wrapper narrows to what's actually used.
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

function candidateDetail(feed: ParsedSource): string {
  return `${feed.link} — ${feed.items.length} items`;
}

export default function Step1Find({ query, onQueryChange, onValidate, type, onTypeChange, status, candidates, selectedIndex, onSelect, error }: Step1FindProps) {
  const feed = candidates[selectedIndex] ?? null;
  const copy = COPY[type ?? "anything"];

  return (
    <div className="flex flex-col gap-1 px-7.5 py-5.5">
      <Input
        aria-label="Feed URL"
        size="lg"
        icon={LinkIcon}
        placeholder={copy.placeholder}
        value={query}
        onChange={onQueryChange}
        onBlur={onValidate}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onValidate();
          }
        }}
        wrapperClassName="rounded-full"
      />
      <p className="mb-4.5 px-1.5 text-xs text-tertiary text-pretty">{copy.hint}</p>

      <div className="mb-5.5 flex flex-wrap gap-0.5 self-start rounded-3xl bg-primary_hover p-0.75">
        {KINDS.map((option) => (
          <Button
            key={option.label}
            size="sm"
            color={option.id === type ? "secondary" : "tertiary"}
            className="rounded-full"
            onPress={() => onTypeChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {status === "loading" && <FeedMatchCard title="Searching…" detail={query} status="loading" />}
      {status === "found" && candidates.length === 1 && feed && (
        <FeedMatchCard
          title={feed.title || feed.link}
          detail={candidateDetail(feed)}
          status="found"
          faviconUrl={resolveFeedIcon(feed.icon, feed.link)}
        />
      )}
      {status === "found" && candidates.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 px-1.5 text-xs text-tertiary">{candidates.length} feeds found. Pick one.</legend>
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
                detail={candidateDetail(candidate)}
                status="found"
                selected={index === selectedIndex}
                faviconUrl={resolveFeedIcon(candidate.icon, candidate.link)}
              />
            </label>
          ))}
        </fieldset>
      )}
      {status === "not-found" && (
        <FeedMatchCard title="No feed found" detail={error?.message ?? "Couldn't find a feed at that address."} status="not-found" />
      )}
    </div>
  );
}
