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
  { id: "rss", label: "RSS · Atom" },
  { id: "youtube", label: "YouTube" },
];

const COPY: Record<"anything" | SourceType, { placeholder: string; hint: string }> = {
  anything: {
    placeholder: "Paste a link to an RSS feed or a YouTube channel…",
    hint: "Monfil checks the link for an RSS feed or a YouTube channel.",
  },
  rss: {
    placeholder: "Paste a link to an RSS feed…",
    hint: "Monfil checks the link for an RSS feed.",
  },
  youtube: {
    placeholder: "Paste a channel, handle, or video link…",
    hint: "Monfil checks the link for a YouTube channel or video.",
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
  type: FeedType;
  onTypeChange: (type: FeedType) => void;
  status: FeedValidationStatus;
  feed: ParsedSource | null;
  error: FeedFetchError | null;
}

export default function Step1Find({ query, onQueryChange, type, onTypeChange, status, feed, error }: Step1FindProps) {
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
        wrapperClassName="rounded-full"
      />
      <p className="mb-4.5 px-1.5 text-xs text-tertiary text-pretty">{copy.hint}</p>

      <div className="mb-5.5 flex w-max gap-0.5 rounded-full bg-primary_hover p-0.75">
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
      {status === "found" && feed && (
        <FeedMatchCard
          title={feed.title || feed.link}
          detail={`${feed.link} — ${feed.items.length} items`}
          status="found"
          faviconUrl={resolveFeedIcon(feed.icon, feed.link)}
        />
      )}
      {status === "not-found" && (
        <FeedMatchCard title="No feed found" detail={error?.message ?? "Couldn't find a feed at that address."} status="not-found" />
      )}
    </div>
  );
}
