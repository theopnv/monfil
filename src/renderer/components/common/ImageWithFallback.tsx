import { useState } from "react";
import { cx } from "@/components/untitled-ui/utils/cx";

export interface ImageWithFallbackProps {
  src: string | undefined;
  className?: string | undefined;
  testId: string;
}

export default function ImageWithFallback({ src, className, testId }: ImageWithFallbackProps) {
  const [isFailed, setIsFailed] = useState(false);

  if (!src || isFailed) {
    return null;
  }

  return <img data-testid={testId} src={src} alt="" onError={() => setIsFailed(true)} className={cx("object-cover", className)} />;
}
