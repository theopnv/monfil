import ImageWithFallback from "@/components/common/ImageWithFallback";

export interface ArticleHeroImageProps {
  src: string | undefined;
}

export default function ArticleHeroImage({ src }: ArticleHeroImageProps) {
  return <ImageWithFallback src={src} className="mb-8.5 h-75 w-full rounded-xl" testId="article-hero-image" />;
}
