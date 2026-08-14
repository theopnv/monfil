import { useState } from "react";
import { cx } from "@/components/untitled-ui/utils/cx";

export interface FeedAvatarProps {
  title: string;
  faviconUrl?: string | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "size-4.5 text-[9px]",
  md: "size-5 text-[10px]",
  lg: "size-11.5 text-base",
};

function getInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (words[0] ?? "").slice(0, 2).toUpperCase();
}

export default function FeedAvatar({ title, faviconUrl, size = "sm", className }: FeedAvatarProps) {
  const [isFailed, setIsFailed] = useState(false);

  return (
    <span
      className={cx(
        "flex flex-none items-center justify-center overflow-hidden rounded-md bg-brand-secondary font-bold text-brand-secondary",
        sizeClasses[size],
        className,
      )}
    >
      {faviconUrl && !isFailed ? (
        <img data-testid="favicon-img" className="size-full object-cover" src={faviconUrl} alt="" onError={() => setIsFailed(true)} />
      ) : (
        getInitials(title)
      )}
    </span>
  );
}
