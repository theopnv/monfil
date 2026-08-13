import { cx } from "@/components/untitled-ui/utils/cx";

export interface FeedAvatarProps {
  title: string;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "size-4.5 text-[9px]",
  md: "size-5 text-[10px]",
};

function getInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (words[0] ?? "").slice(0, 2).toUpperCase();
}

export default function FeedAvatar({ title, size = "sm", className }: FeedAvatarProps) {
  return (
    <span
      className={cx(
        "flex flex-none items-center justify-center rounded-md bg-brand-secondary font-bold text-brand-secondary",
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(title)}
    </span>
  );
}
