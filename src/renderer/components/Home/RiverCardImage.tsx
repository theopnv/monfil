// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import ImageWithFallback from "@/components/common/ImageWithFallback";

export interface RiverCardImageProps {
  src: string | undefined;
  className?: string | undefined;
}

export default function RiverCardImage({ src, className }: RiverCardImageProps) {
  return <ImageWithFallback src={src} className={className} testId="river-card-image" />;
}
