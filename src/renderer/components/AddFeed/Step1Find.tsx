import { Link02 } from "@untitledui/icons";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import FeedMatchCard from "./FeedMatchCard";
import type { FeedValidationStatus } from "./useFeedValidation";
import type { ParsedFeed, FeedFetchError } from "../../../main/feed/parse";

export type FeedKind = "anything" | "rss-atom";

const KINDS: { id: FeedKind; label: string }[] = [
  { id: "anything", label: "Anything" },
  { id: "rss-atom", label: "RSS · Atom" },
];

// Input's `icon` prop is typed as ComponentType<HTMLAttributes<HTMLOrSVGElement>>,
// but @untitledui/icons components are typed against SVGProps. InputBase only
// ever passes `className`, so this wrapper narrows to what's actually used.
function LinkIcon({ className }: { className?: string | undefined }) {
  return <Link02 className={className} />;
}

export interface Step1FindProps {
  query: string;
  onQueryChange: (query: string) => void;
  kind: FeedKind;
  onKindChange: (kind: FeedKind) => void;
  status: FeedValidationStatus;
  feed: ParsedFeed | null;
  error: FeedFetchError | null;
}

export default function Step1Find({ query, onQueryChange, kind, onKindChange, status, feed, error }: Step1FindProps) {
  return (
    <div className="flex flex-col gap-1 px-7.5 py-5.5">
      <Input
        aria-label="Feed URL"
        size="lg"
        icon={LinkIcon}
        placeholder="Paste a link to an RSS feed…"
        value={query}
        onChange={onQueryChange}
        wrapperClassName="rounded-full"
      />
      <p className="mb-4.5 px-1.5 text-xs text-tertiary text-pretty">Monfil checks the link for an RSS feed.</p>

      <div className="mb-5.5 flex w-max gap-0.5 rounded-full bg-primary_hover p-0.75">
        {KINDS.map((option) => (
          <Button
            key={option.id}
            size="sm"
            color={option.id === kind ? "secondary" : "tertiary"}
            className="rounded-full"
            onPress={() => onKindChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {status === "loading" && <FeedMatchCard title="Searching…" detail={query} status="loading" />}
      {status === "found" && feed && (
        <FeedMatchCard title={feed.title || feed.link} detail={`${feed.link} — ${feed.items.length} items`} status="found" />
      )}
      {status === "not-found" && (
        <FeedMatchCard title="No feed found" detail={error?.message ?? "Couldn't find a feed at that address."} status="not-found" />
      )}
    </div>
  );
}
