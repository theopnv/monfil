import FeedAvatar from "@/components/Home/FeedAvatar";
import { Badge } from "@/components/untitled-ui/base/badges/badges";
import { cx } from "@/components/untitled-ui/utils/cx";

export type FeedMatchStatus = "loading" | "found" | "not-found";

export interface FeedMatchCardProps {
  title: string;
  detail: string;
  status: FeedMatchStatus;
}

const badgeLabel: Record<Exclude<FeedMatchStatus, "loading">, string> = {
  found: "Feed found",
  "not-found": "Not found",
};

export default function FeedMatchCard({ title, detail, status }: FeedMatchCardProps) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors",
        status === "found" && "border-brand bg-brand-primary_alt",
        status === "not-found" && "border-error_subtle bg-error-primary",
        status === "loading" && "border-secondary opacity-60",
      )}
    >
      <FeedAvatar title={title} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{title}</p>
        <p className="truncate text-xs text-tertiary">{detail}</p>
      </div>
      {status === "loading" && <span className="text-xs text-quaternary">Checking…</span>}
      {status !== "loading" && (
        <Badge color={status === "found" ? "success" : "error"} size="sm" className="tracking-wide uppercase">
          {badgeLabel[status]}
        </Badge>
      )}
    </div>
  );
}
