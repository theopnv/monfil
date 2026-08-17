import ImageWithFallback from "@/components/common/ImageWithFallback";

export interface RiverCardImageProps {
  src: string | undefined;
  className?: string | undefined;
}

export default function RiverCardImage({ src, className }: RiverCardImageProps) {
  return <ImageWithFallback src={src} className={className} fallbackLabel="article image" testId="river-card-image" />;
}
