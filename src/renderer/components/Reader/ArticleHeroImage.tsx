// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import ImageWithFallback from "@/components/common/ImageWithFallback";

export interface ArticleHeroImageProps {
  src: string | undefined;
}

export default function ArticleHeroImage({ src }: ArticleHeroImageProps) {
  return <ImageWithFallback src={src} className="mb-8.5 h-75 w-full rounded-xl" testId="article-hero-image" />;
}
