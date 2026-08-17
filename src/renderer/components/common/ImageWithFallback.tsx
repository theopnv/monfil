import { useState } from "react";
import { cx } from "@/components/untitled-ui/utils/cx";

export interface ImageWithFallbackProps {
  src: string | undefined;
  className?: string | undefined;
  fallbackLabel: string;
  testId: string;
}

export default function ImageWithFallback({ src, className, fallbackLabel, testId }: ImageWithFallbackProps) {
  const [isFailed, setIsFailed] = useState(false);

  if (src && !isFailed) {
    return <img data-testid={testId} src={src} alt="" onError={() => setIsFailed(true)} className={cx("object-cover", className)} />;
  }

  return (
    <div className={cx("flex items-center justify-center bg-brand-secondary bg-[repeating-linear-gradient(118deg,transparent_0_9px,color-mix(in_srgb,var(--color-brand-500)_22%,transparent)_9px_18px)]", className)}>
      <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[9.5px] text-brand-tertiary">{fallbackLabel}</span>
    </div>
  );
}
