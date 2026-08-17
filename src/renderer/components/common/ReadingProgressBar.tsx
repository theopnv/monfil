export interface ReadingProgressBarProps {
  progress: number;
}

export default function ReadingProgressBar({ progress }: ReadingProgressBarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 h-0.75 flex-none">
      <div className="h-full bg-brand-solid transition-[width] duration-75 ease-linear" style={{ width: `${progress}%` }} />
    </div>
  );
}
